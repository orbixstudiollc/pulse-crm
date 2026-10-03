import { describe, expect, it } from 'vitest';

import {
  invoiceNumber,
  kickoffWonDeal,
  parseChecklist,
  parseProposalServices,
  splitAmount,
  type KickoffSettings,
} from 'src/gtm/agency/kickoff';
import { FakeRecords, fakeWriter } from 'src/__tests__/agency-kickoff-fakes';

const NOW = new Date('2026-10-03T12:00:00Z');

const SETTINGS: KickoffSettings = {
  depositPercent: 50,
  invoiceDueDays: 7,
  currency: 'USD',
  intakeFormUrl: 'https://forms.example.com/intake',
  bookingLink: 'https://cal.example.com/kickoff',
  autoSend: false,
};

const setup = (dealOverrides: Record<string, unknown> = {}) => {
  const records = new FakeRecords();
  records.now = NOW;
  records.seed('companies', { id: 'c1', name: 'Acme' });
  records.seed('people', {
    id: 'p1',
    name: { firstName: 'Ada', lastName: 'Lovelace' },
    emails: { primaryEmail: 'ada@acme.com' },
    leadStatus: 'HOT',
  });
  records.seed('opportunities', {
    id: 'o1',
    name: 'Acme rebrand',
    stage: 'CUSTOMER',
    amount: { amountMicros: 12_000_000_000, currencyCode: 'USD' },
    pointOfContactId: 'p1',
    companyId: 'c1',
    ...dealOverrides,
  });
  records.seed('agencyServices', {
    id: 's1',
    name: 'Brand Identity',
    priceFrom: 6000,
    deliveryWeeks: 4,
    taskChecklist: 'Kickoff call +1\nMoodboard +5\nLogo concepts +12\n- Brand guidelines',
  });
  records.seed('agencyServices', { id: 's2', name: 'Website', priceFrom: 8000, deliveryWeeks: 6, taskChecklist: null });
  return records;
};

const run = (records: FakeRecords, writer = fakeWriter({ subject: 'Welcome, Ada!', body: 'Hi Ada, so glad to start.' }).writer) =>
  kickoffWonDeal({ records, writer, settings: SETTINGS, opportunityId: 'o1', now: NOW, random: () => 0 });

describe('parsers', () => {
  it('reads proposal lines and checklists', () => {
    expect(parseProposalServices('Brand Identity | $6,000\n- Website | 8000.50\n\nExtra')).toEqual([
      { name: 'Brand Identity', price: 6000 },
      { name: 'Website', price: 8000.5 },
      { name: 'Extra', price: null },
    ]);
    expect(parseChecklist('Moodboard +5\nLogo\n')).toEqual([
      { title: 'Moodboard', days: 5 },
      { title: 'Logo', days: 1 },
    ]);
  });

  it('splits amounts to the cent and names invoices', () => {
    expect(splitAmount(100, [1, 1, 1])).toEqual([33.33, 33.33, 33.34]);
    expect(splitAmount(7000, [6000, 8000])).toEqual([3000, 4000]);
    expect(invoiceNumber(NOW, () => 0)).toBe('INV-20261003-AAAA');
  });
});

describe('kickoffWonDeal', () => {
  it('creates one project per service from the accepted proposal, with tasks, deposit invoice and welcome email', async () => {
    const records = setup();
    records.seed('proposals', { id: 'pr0', opportunityId: 'o1', status: 'DECLINED', services: 'Website | 1', amount: 1 });
    records.seed('proposals', {
      id: 'pr1',
      opportunityId: 'o1',
      status: 'ACCEPTED',
      services: 'brand identity | 6000\nWebsite | 8000\nUnknown thing | 500',
      amount: 14000,
      personId: 'p1',
    });
    const { writer, calls } = fakeWriter({ subject: 'Welcome, Ada!', body: 'Hi Ada, so glad to start.' });
    const result = await run(records, writer);

    expect(result.ok).toBe(true);
    const projects = records.table('clientProjects');
    expect(projects.map((p) => [p.name, p.value, p.serviceId, p.startDate, p.dueDate, p.status])).toEqual([
      ['Acme – Brand Identity', 6000, 's1', '2026-10-03', '2026-10-31', 'KICKOFF'],
      ['Acme – Website', 8000, 's2', '2026-10-03', '2026-11-14', 'KICKOFF'],
    ]);
    expect(projects[0]).toMatchObject({ opportunityId: 'o1', companyId: 'c1', personId: 'p1' });

    const tasks = records.tasksWithTargets();
    const brand = tasks.filter((t) => t.targets.some((x: any) => x.targetClientProjectId === projects[0].id));
    expect(brand.map((t) => [t.title, t.dueAt.slice(0, 10)])).toEqual([
      ['Kickoff call (Brand Identity)', '2026-10-04'],
      ['Moodboard (Brand Identity)', '2026-10-08'],
      ['Logo concepts (Brand Identity)', '2026-10-15'],
      ['Brand guidelines (Brand Identity)', '2026-10-04'],
    ]);
    // Website has no checklist: the fallback, spread over 6 weeks.
    const site = tasks.filter((t) => t.targets.some((x: any) => x.targetClientProjectId === projects[1].id));
    expect(site.map((t) => t.title)).toEqual([
      'Kickoff call (Website)',
      'Collect brand assets & access (Website)',
      'First draft (Website)',
      'Client review (Website)',
      'Final delivery (Website)',
    ]);
    expect(site[4].dueAt.slice(0, 10)).toBe('2026-11-14');

    expect(records.get('people', 'p1')!.leadStatus).toBe('CUSTOMER');

    const [invoice] = records.table('clientInvoices');
    expect(invoice).toMatchObject({
      name: 'INV-20261003-AAAA',
      status: 'DRAFT',
      amount: 7000,
      dueDate: '2026-10-10',
      companyId: 'c1',
      projectId: projects[0].id,
      personId: 'p1',
      lineItems: 'Brand Identity – 50% deposit | 1 | 3000.00\nWebsite – 50% deposit | 1 | 4000.00',
    });
    const approve = tasks.find((t) => t.title === 'Approve the deposit invoice for Acme');
    expect(approve?.targets).toContainEqual({ targetClientInvoiceId: invoice.id });

    const [email] = records.table('clientEmails');
    expect(email).toMatchObject({ kind: 'WELCOME', status: 'DRAFT', toEmail: 'ada@acme.com', personId: 'p1', projectId: projects[0].id });
    // Links the AI left out are added.
    expect(email.body).toContain('https://forms.example.com/intake');
    expect(email.body).toContain('https://cal.example.com/kickoff');
    expect(calls[0].prompt).toContain('Deposit invoice: yes');
    expect(result.invoiceId).toBe(invoice.id);
  });

  it('is idempotent per deal', async () => {
    const records = setup();
    await run(records);
    const counts = () => [records.table('clientProjects').length, records.table('clientInvoices').length, records.table('tasks').length];
    const before = counts();
    const again = await run(records);
    expect(again.skipped).toBe('Deal already has a project');
    expect(counts()).toEqual(before);
  });

  it('uses the one catalog service the deal is named after, valued at the deal amount', async () => {
    const records = setup({ name: 'Acme – Brand Identity refresh' });
    await run(records);
    const projects = records.table('clientProjects');
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ name: 'Acme – Brand Identity', serviceId: 's1', value: 12000 });
    expect(records.table('clientInvoices')[0]).toMatchObject({
      amount: 6000,
      lineItems: 'Brand Identity – 50% deposit | 1 | 6000.00',
    });
  });

  it('makes one project for the deal with the fallback checklist when no service matches', async () => {
    const records = setup({ name: 'Website and Brand Identity' }); // two matches: ambiguous
    const { writer } = fakeWriter(new Error('model down'));
    await run(records, writer);
    const [project, ...rest] = records.table('clientProjects');
    expect(rest).toHaveLength(0);
    expect(project).toMatchObject({ name: 'Acme – Website and Brand Identity', value: 12000, serviceId: null, dueDate: null });
    expect(records.table('tasks').map((t) => t.title).slice(0, 5)).toEqual([
      'Kickoff call',
      'Collect brand assets & access',
      'First draft',
      'Client review',
      'Final delivery',
    ]);
    // AI failed: the template is used, with both links and the Stripe note.
    const [email] = records.table('clientEmails');
    expect(email.subject).toBe('Welcome aboard, Acme!');
    expect(email.body).toContain('https://forms.example.com/intake');
    expect(email.body).toContain('https://cal.example.com/kickoff');
    expect(email.body).toContain('Stripe');
  });

  it('skips the invoice and asks for the amount when the deal has none', async () => {
    const records = setup({ name: 'Something', amount: { amountMicros: 0, currencyCode: 'USD' } });
    const result = await run(records);
    expect(result.invoiceId).toBeNull();
    expect(records.table('clientInvoices')).toHaveLength(0);
    const task = records.tasksWithTargets().find((t) => t.title === 'Set the deal amount to invoice Acme');
    expect(task?.targets).toContainEqual({ targetOpportunityId: 'o1' });
    expect(records.table('clientEmails')[0].body).not.toContain('Stripe');
  });

  it('approves the welcome email straight away when auto-send is on', async () => {
    const records = setup();
    await kickoffWonDeal({ records, writer: null, settings: { ...SETTINGS, autoSend: true }, opportunityId: 'o1', now: NOW });
    expect(records.table('clientEmails')[0].status).toBe('APPROVED');
  });
});
