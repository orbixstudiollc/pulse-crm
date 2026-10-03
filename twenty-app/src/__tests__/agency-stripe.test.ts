import { describe, expect, it } from 'vitest';

import {
  createStripeClient,
  sendInvoice,
  syncInvoices,
  toMinorUnits,
  type FetchLike,
  type StripeClient,
  type StripeInvoice,
} from 'src/gtm/agency/stripe';
import { FakeRecords, fakeWriter } from 'src/__tests__/agency-kickoff-fakes';

const NOW = new Date('2026-10-03T12:00:00Z');
const DAY = 86_400_000;
const SETTINGS = { stripeSecretKey: 'sk_test_123', currency: 'USD', invoiceDueDays: 7, autoSend: false };

type Call = { method: string; url: string; headers: Record<string, string>; body: Record<string, string> };

// Fake Stripe over fetch: records each request with its decoded form body.
const fakeStripeFetch = (opts: { existingCustomer?: boolean; failOn?: string } = {}) => {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    const body = Object.fromEntries(new URLSearchParams(init.body ?? ''));
    calls.push({ method: init.method, url, headers: init.headers, body });
    const json = (status: number, data: unknown) => ({ ok: status < 400, status, json: async () => data });
    const path = url.replace('https://api.stripe.com/v1', '');
    if (opts.failOn && path.startsWith(opts.failOn)) return json(400, { error: { message: 'Card declined by test' } });
    if (path.startsWith('/customers?')) return json(200, { data: opts.existingCustomer ? [{ id: 'cus_old' }] : [] });
    if (path === '/customers') return json(200, { id: 'cus_new' });
    if (path === '/invoices') return json(200, { id: 'in_1', status: 'draft' });
    if (path === '/invoiceitems') return json(200, { id: `ii_${calls.length}` });
    if (path === '/invoices/in_1/finalize') return json(200, { id: 'in_1', status: 'open', hosted_invoice_url: 'https://pay.stripe.com/i/1' });
    if (path === '/invoices/in_1/send') return json(200, { id: 'in_1', status: 'open', hosted_invoice_url: 'https://pay.stripe.com/i/1' });
    return json(404, { error: { message: `No route ${path}` } });
  };
  return { fetch, calls };
};

const setup = (invoice: Record<string, unknown> = {}) => {
  const records = new FakeRecords();
  records.now = NOW;
  records.seed('companies', { id: 'c1', name: 'Acme' });
  records.seed('people', { id: 'p1', name: { firstName: 'Ada', lastName: 'Lovelace' }, emails: { primaryEmail: 'ada@acme.com' } });
  records.seed('clientInvoices', {
    id: 'inv1',
    name: 'INV-20261003-ABCD',
    status: 'APPROVED',
    amount: 7000.5,
    lineItems: 'Brand Identity – 50% deposit | 1 | 3000.25\nWebsite – 50% deposit | 2 | 2000.125',
    dueDate: '2026-10-10',
    remindersDrafted: 0,
    stripeInvoiceId: null,
    paymentUrl: null,
    companyId: 'c1',
    projectId: 'proj1',
    personId: 'p1',
    ...invoice,
  });
  return records;
};

describe('Stripe client', () => {
  it('converts to the smallest unit, whole units for zero-decimal currencies', () => {
    expect(toMinorUnits(3000.25, 'USD')).toBe(300025);
    expect(toMinorUnits(19.999, 'eur')).toBe(2000);
    expect(toMinorUnits(1200, 'JPY')).toBe(1200);
    expect(toMinorUnits(1200.4, 'krw')).toBe(1200);
  });

  it('reuses an existing customer by email', async () => {
    const { fetch, calls } = fakeStripeFetch({ existingCustomer: true });
    const id = await createStripeClient('sk_test_123', fetch).findOrCreateCustomer('a+b@acme.com', 'Acme', 'k');
    expect(id).toBe('cus_old');
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toBe('https://api.stripe.com/v1/customers?email=a%2Bb%40acme.com&limit=1');
    expect(calls[0].headers.Authorization).toBe('Bearer sk_test_123');
  });
});

describe('sendInvoice', () => {
  it('creates, fills, finalizes and sends the invoice in Stripe, then stores it as Sent', async () => {
    const records = setup();
    const { fetch, calls } = fakeStripeFetch();
    const result = await sendInvoice({ records, stripe: createStripeClient('sk_test_123', fetch), settings: SETTINGS, invoiceId: 'inv1', now: NOW });

    expect(result).toEqual({ ok: true, stripeInvoiceId: 'in_1' });
    expect(calls.map((c) => `${c.method} ${c.url.replace('https://api.stripe.com/v1', '')}`)).toEqual([
      'GET /customers?email=ada%40acme.com&limit=1',
      'POST /customers',
      'POST /invoices',
      'POST /invoiceitems',
      'POST /invoiceitems',
      'POST /invoices/in_1/finalize',
      'POST /invoices/in_1/send',
    ]);
    expect(calls[1].body).toEqual({ email: 'ada@acme.com', name: 'Acme' });
    expect(calls[2].body).toMatchObject({
      customer: 'cus_new',
      collection_method: 'send_invoice',
      days_until_due: '7',
      currency: 'usd',
      auto_advance: 'false',
      'metadata[pulseInvoiceId]': 'inv1',
    });
    expect(calls[3].body).toEqual({
      customer: 'cus_new',
      invoice: 'in_1',
      currency: 'usd',
      description: 'Brand Identity – 50% deposit',
      amount: '300025',
    });
    expect(calls[4].body).toMatchObject({ invoice: 'in_1', amount: '400025' });
    expect(calls[4].body.description).toContain('Website – 50% deposit (2 ×');

    // One idempotency key per invoice record and step.
    const keys = calls.filter((c) => c.method === 'POST').map((c) => c.headers['Idempotency-Key']);
    expect(keys).toEqual([
      'pulse-invoice-inv1-customer',
      'pulse-invoice-inv1-invoice',
      'pulse-invoice-inv1-item-0',
      'pulse-invoice-inv1-item-1',
      'pulse-invoice-inv1-finalize',
      'pulse-invoice-inv1-send',
    ]);
    expect(calls[0].headers['Idempotency-Key']).toBeUndefined();

    expect(records.get('clientInvoices', 'inv1')).toMatchObject({
      status: 'SENT',
      stripeInvoiceId: 'in_1',
      paymentUrl: 'https://pay.stripe.com/i/1',
      sentAt: NOW.toISOString(),
    });
  });

  it('sends whole units for zero-decimal currencies', async () => {
    const records = setup({ lineItems: 'Logo | 1 | 150000', amount: 150000 });
    const { fetch, calls } = fakeStripeFetch();
    await sendInvoice({ records, stripe: createStripeClient('k', fetch), settings: { ...SETTINGS, currency: 'JPY' }, invoiceId: 'inv1', now: NOW });
    const item = calls.find((c) => c.url.endsWith('/invoiceitems'))!;
    expect(item.body).toMatchObject({ currency: 'jpy', amount: '150000' });
  });

  it('retries with the same idempotency keys after a failure, and goes back to Draft with a task', async () => {
    const records = setup();
    const first = fakeStripeFetch({ failOn: '/invoices/in_1/send' });
    const failed = await sendInvoice({ records, stripe: createStripeClient('k', first.fetch), settings: SETTINGS, invoiceId: 'inv1', now: NOW });
    expect(failed.ok).toBe(false);
    expect(records.get('clientInvoices', 'inv1')).toMatchObject({ status: 'DRAFT', stripeInvoiceId: null });
    expect(records.table('tasks')[0].title).toContain('Card declined by test');

    records.get('clientInvoices', 'inv1')!.status = 'APPROVED';
    const second = fakeStripeFetch();
    await sendInvoice({ records, stripe: createStripeClient('k', second.fetch), settings: SETTINGS, invoiceId: 'inv1', now: NOW });
    const keys = (c: Call[]) => c.filter((x) => x.method === 'POST').map((x) => x.headers['Idempotency-Key']);
    expect(keys(second.calls).slice(0, 5)).toEqual(keys(first.calls).slice(0, 5));
    expect(records.get('clientInvoices', 'inv1')!.status).toBe('SENT');
  });

  it('does nothing unless the invoice is Approved and not yet in Stripe', async () => {
    const { fetch, calls } = fakeStripeFetch();
    const stripe = createStripeClient('k', fetch);
    expect((await sendInvoice({ records: setup({ status: 'DRAFT' }), stripe, settings: SETTINGS, invoiceId: 'inv1', now: NOW })).skipped).toBe('Status is DRAFT');
    expect((await sendInvoice({ records: setup({ stripeInvoiceId: 'in_9' }), stripe, settings: SETTINGS, invoiceId: 'inv1', now: NOW })).skipped).toBe('Already in Stripe');
    expect(calls).toHaveLength(0);
  });

  it('needs the bill-to email', async () => {
    const records = setup({ personId: null });
    const { fetch, calls } = fakeStripeFetch();
    const result = await sendInvoice({ records, stripe: createStripeClient('k', fetch), settings: SETTINGS, invoiceId: 'inv1', now: NOW });
    expect(result.error).toBe('The Bill to person has no email address');
    expect(calls).toHaveLength(0);
    expect(records.get('clientInvoices', 'inv1')!.status).toBe('DRAFT');
    expect(records.tasksWithTargets()[0].targets).toContainEqual({ targetClientInvoiceId: 'inv1' });
  });

  it('leaves the invoice Approved and asks for the key when Stripe is not set up', async () => {
    const records = setup();
    const result = await sendInvoice({ records, stripe: null, settings: { ...SETTINGS, stripeSecretKey: null }, invoiceId: 'inv1', now: NOW });
    expect(result.skipped).toBe('No Stripe key');
    expect(records.get('clientInvoices', 'inv1')!.status).toBe('APPROVED');
    expect(records.table('tasks')[0].title).toBe('Add your Stripe secret key in Pulse Variables to send invoice INV-20261003-ABCD');
  });
});

describe('syncInvoices', () => {
  const fakeStripe = (byId: Record<string, StripeInvoice>): StripeClient & { retrieved: string[] } => {
    const retrieved: string[] = [];
    const unused = async () => {
      throw new Error('not used');
    };
    return {
      retrieved,
      retrieve: async (id) => {
        retrieved.push(id);
        return byId[id];
      },
      findOrCreateCustomer: unused,
      createInvoice: unused,
      addInvoiceItem: unused,
      finalize: unused,
      send: unused,
    };
  };

  const sentInvoice = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    name: `INV-${id}`,
    status: 'SENT',
    amount: 500,
    dueDate: '2026-10-10',
    remindersDrafted: 0,
    stripeInvoiceId: `in_${id}`,
    paymentUrl: `https://pay.stripe.com/${id}`,
    personId: 'p1',
    projectId: 'proj1',
    ...extra,
  });

  it('marks paid and void invoices from Stripe', async () => {
    const records = setup({ status: 'DRAFT' });
    records.seed('clientInvoices', sentInvoice('a'));
    records.seed('clientInvoices', sentInvoice('b', { status: 'OVERDUE' }));
    records.seed('clientInvoices', sentInvoice('c'));
    records.seed('clientInvoices', sentInvoice('d', { status: 'PAID' }));
    const paidAt = Date.parse('2026-10-02T08:00:00Z') / 1000;
    const stripe = fakeStripe({
      in_a: { id: 'in_a', status: 'paid', status_transitions: { paid_at: paidAt } },
      in_b: { id: 'in_b', status: 'uncollectible' },
      in_c: { id: 'in_c', status: 'open' },
    });
    await syncInvoices({ records, stripe, writer: null, settings: SETTINGS, now: NOW });
    expect(stripe.retrieved).toEqual(['in_a', 'in_b', 'in_c']);
    expect(records.get('clientInvoices', 'a')).toMatchObject({ status: 'PAID', paidAt: '2026-10-02T08:00:00.000Z' });
    expect(records.get('clientInvoices', 'b')!.status).toBe('VOID');
    expect(records.get('clientInvoices', 'c')!.status).toBe('SENT');
    expect(records.table('clientEmails')).toHaveLength(0);
  });

  it('marks unpaid invoices past due Overdue and drafts a reminder with the payment link', async () => {
    const records = setup({ status: 'DRAFT' });
    records.seed('clientInvoices', sentInvoice('a', { dueDate: '2026-10-02' }));
    records.seed('clientInvoices', sentInvoice('b', { dueDate: '2026-10-03' })); // due today: not yet
    const stripe = fakeStripe({ in_a: { id: 'in_a', status: 'open' }, in_b: { id: 'in_b', status: 'open' } });
    const { writer, calls } = fakeWriter({ subject: 'Quick reminder', body: 'Hi Ada, a gentle nudge.' });
    const results = await syncInvoices({ records, stripe, writer, settings: SETTINGS, now: NOW });

    expect(results[0]).toMatchObject({ id: 'a', status: 'OVERDUE' });
    expect(records.get('clientInvoices', 'a')).toMatchObject({ status: 'OVERDUE', remindersDrafted: 1 });
    expect(records.get('clientInvoices', 'b')!.status).toBe('SENT');
    const [email] = records.table('clientEmails');
    expect(email).toMatchObject({ kind: 'INVOICE_REMINDER', status: 'DRAFT', invoiceId: 'a', toEmail: 'ada@acme.com', personId: 'p1' });
    expect(email.body).toContain('https://pay.stripe.com/a');
    expect(calls[0].prompt).toContain('$500');
  });

  it('spaces reminders 5 days apart and stops at two', async () => {
    const records = setup({ status: 'DRAFT' });
    records.seed('clientInvoices', sentInvoice('a', { status: 'OVERDUE', dueDate: '2026-09-20' }));
    const reminders = () => records.table('clientEmails').filter((e) => e.invoiceId === 'a').length;
    const at = async (days: number) => {
      records.now = new Date(NOW.getTime() + days * DAY);
      await syncInvoices({ records, stripe: null, writer: null, settings: SETTINGS, now: records.now });
    };
    await at(0);
    expect(reminders()).toBe(1);
    await at(1);
    await at(4);
    expect(reminders()).toBe(1);
    await at(5);
    expect(reminders()).toBe(2);
    await at(11);
    await at(30);
    expect(reminders()).toBe(2);
    expect(records.get('clientInvoices', 'a')!.remindersDrafted).toBe(2);
    expect(records.table('clientEmails')[0].body).toContain('https://pay.stripe.com/a');
  });
});
