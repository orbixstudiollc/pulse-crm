import { describe, expect, it } from 'vitest';

import {
  clampPrice,
  draftProposal,
  followUpDue,
  markdownToHtml,
  parseRespondBody,
  proposalFollowUps,
  proposalPageResponse,
  proposalRespondResponse,
  recordProposalView,
  renderProposalPage,
  respondToProposal,
  validateServices,
  type ProposalRow,
  type ServiceRow,
} from 'src/gtm/agency/proposals';

import { FakeRecords, FakeWriter, settingsFor } from './agency-proposal-fakes';

const NOW = new Date('2026-10-03T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();
const TOKEN = 'abcdefghijklmnopqrstuvwx';

const service = (over: Partial<ServiceRow> & { name: string; isActive?: boolean }): ServiceRow & { isActive: boolean } => ({
  id: `svc-${over.name}`,
  category: 'DEVELOPMENT',
  description: null,
  priceFrom: null,
  priceTo: null,
  deliveryWeeks: 4,
  deliverables: null,
  isActive: true,
  ...over,
});

const seedDeal = (stage = 'MEETING') => {
  const r = new FakeRecords();
  r.add('companies', { id: 'co-1', name: 'Acme', domainName: { primaryLinkUrl: 'https://acme.test' } });
  r.add('people', { id: 'p-1', name: { firstName: 'Ada', lastName: 'Lovelace' }, emails: { primaryEmail: 'ada@acme.test' }, jobTitle: 'CEO', companyId: 'co-1' });
  r.add('opportunities', { id: 'opp-1', name: 'Acme website', stage, amount: null, pointOfContactId: 'p-1', companyId: 'co-1' });
  r.add('noteTargets', { id: 'nt-1', targetOpportunityId: 'opp-1', note: { id: 'n-1', title: 'Discovery call', bodyV2: { markdown: 'Needs a new site and brand refresh' }, createdAt: ago(1) } });
  r.add('inboxItems', { id: 'ib-1', personId: 'p-1', subject: 'Re: hello', snippet: 'Keen to chat', aiSummary: 'Interested in a redesign', createdAt: ago(5) });
  r.add('agencyServices', service({ name: 'Website build', priceFrom: 8000, priceTo: 15000, deliveryWeeks: 6 }));
  r.add('agencyServices', service({ name: 'Brand refresh', priceFrom: 4000 }));
  r.add('agencyServices', service({ name: 'SEO audit' }));
  r.add('agencyServices', service({ name: 'Retired thing', priceFrom: 100, isActive: false }));
  return r;
};

const aiProposal = (over: Record<string, unknown> = {}) => ({
  title: 'Acme website and brand',
  summary: 'New site and brand refresh.',
  services: [
    { name: 'Website build', price: 99999 },
    { name: 'brand refresh', price: 1 },
    { name: 'SEO audit', price: 500 },
    { name: 'Made up service', price: 3000 },
    { name: 'Retired thing', price: 100 },
  ],
  body: '## Overview\nHi\n\n## Investment\n| Service | Price |\n| --- | --- |\n| Made up service | $3,000 |\n\n## Next steps\nSay yes.',
  email: { subject: 'Your proposal', body: 'Hi Ada,\n\nHere is the proposal.' },
  ...over,
});

describe('catalog validation', () => {
  const catalog = [service({ name: 'A', priceFrom: 100, priceTo: 200 }), service({ name: 'B', priceFrom: 50 }), service({ name: 'C' })];

  it('clamps prices into the range, fixes single prices and leaves unpriced services null', () => {
    expect(clampPrice(catalog[0], 500)).toBe(200);
    expect(clampPrice(catalog[0], 10)).toBe(100);
    expect(clampPrice(catalog[0], '150')).toBe(150);
    expect(clampPrice(catalog[0], null)).toBe(100);
    expect(clampPrice(catalog[1], 999)).toBe(50);
    expect(clampPrice(catalog[2], 999)).toBeNull();
  });

  it('drops services not in the catalog and duplicates', () => {
    const out = validateServices([{ name: ' a ', price: 150 }, { name: 'A', price: 150 }, { name: 'Z', price: 1 }, 'B'], catalog);
    expect(out.map((s) => [s.name, s.price])).toEqual([['A', 150], ['B', 50]]);
  });
});

describe('draftProposal', () => {
  it('creates a checked proposal, the client email with the link, and moves the deal', async () => {
    const r = seedDeal();
    const writer = new FakeWriter([aiProposal()]);
    const res = await draftProposal({ records: r, writer, settings: settingsFor(), opportunityId: 'opp-1' });
    expect(res.ok).toBe(true);

    const p = r.get('proposals', res.proposalId as string)!;
    expect(p.status).toBe('DRAFT');
    expect(p.amount).toBe(15000 + 4000);
    expect(p.services).toBe('Website build | 15000\nBrand refresh | 4000\nSEO audit | price to confirm');
    expect(p.publicToken.length).toBeGreaterThanOrEqual(16);
    expect(p.body).not.toContain('Made up service');
    expect(p.body).toContain('| **Total** | **$19,000** |');
    expect(p.body.indexOf('## Investment')).toBeLessThan(p.body.indexOf('## Next steps'));
    expect(p.personId).toBe('p-1');

    const email = r.get('clientEmails', res.clientEmailId as string)!;
    expect(email.kind).toBe('PROPOSAL');
    expect(email.toEmail).toBe('ada@acme.test');
    expect(email.status).toBe('DRAFT');
    expect(email.body).toContain(`https://fn.example.com/s/proposal?t=${p.publicToken}`);

    expect(r.get('opportunities', 'opp-1')!.stage).toBe('PROPOSAL');
    expect(r.get('opportunities', 'opp-1')!.amount).toEqual({ amountMicros: 19000 * 1_000_000, currencyCode: 'USD' });
    // Only active services reach the AI, along with the call notes and emails.
    expect(writer.calls[0].prompt).not.toContain('Retired thing');
    expect(writer.calls[0].prompt).toContain('Needs a new site');
    expect(writer.calls[0].prompt).toContain('Interested in a redesign');
  });

  it('is idempotent unless forced, and drafts again after a decline', async () => {
    const r = seedDeal();
    const writer = new FakeWriter([aiProposal()]);
    const first = await draftProposal({ records: r, writer, settings: settingsFor(), opportunityId: 'opp-1' });
    const again = await draftProposal({ records: r, writer, settings: settingsFor(), opportunityId: 'opp-1' });
    expect(again.skipped).toBeTruthy();
    expect(r.table('proposals')).toHaveLength(1);

    await draftProposal({ records: r, writer, settings: settingsFor(), opportunityId: 'opp-1', force: true });
    expect(r.table('proposals')).toHaveLength(2);

    for (const p of r.table('proposals')) p.status = 'DECLINED';
    await draftProposal({ records: r, writer, settings: settingsFor(), opportunityId: 'opp-1' });
    expect(r.table('proposals')).toHaveLength(3);
    expect(first.ok).toBe(true);
  });

  it('still drafts the email when the public link cannot be built', async () => {
    const r = seedDeal();
    const res = await draftProposal({ records: r, writer: new FakeWriter([aiProposal()]), settings: settingsFor({ publicPagesUrl: null }), opportunityId: 'opp-1' });
    expect(res.ok).toBe(true);
    const email = r.get('clientEmails', res.clientEmailId as string)!;
    expect(email.body).toContain('could not be built');
    expect(email.body).not.toContain('?t=');
  });

  it('does not move a deal backwards and approves the email with auto-send', async () => {
    const r = seedDeal('CUSTOMER');
    const res = await draftProposal({ records: r, writer: new FakeWriter([aiProposal()]), settings: settingsFor({ autoSend: true }), opportunityId: 'opp-1' });
    expect(r.get('opportunities', 'opp-1')!.stage).toBe('CUSTOMER');
    expect(r.get('clientEmails', res.clientEmailId as string)!.status).toBe('APPROVED');
  });

  it('fails cleanly when the AI returns nothing usable', async () => {
    const r = seedDeal();
    const res = await draftProposal({ records: r, writer: new FakeWriter(['sorry']), settings: settingsFor(), opportunityId: 'opp-1' });
    expect(res.ok).toBe(false);
    expect(r.table('proposals')).toHaveLength(0);
  });
});

const seedProposal = (over: Partial<ProposalRow> = {}) => {
  const r = seedDeal('PROPOSAL');
  r.add('proposals', {
    id: 'prop-1',
    name: 'Acme proposal',
    status: 'SENT',
    summary: 'Summary',
    body: '## Overview\nText',
    amount: 19000,
    services: '',
    publicToken: TOKEN,
    sentAt: ago(1),
    viewedAt: null,
    respondedAt: null,
    followUpsSent: 0,
    lastFollowUpAt: null,
    clientComment: null,
    opportunityId: 'opp-1',
    personId: 'p-1',
    ...over,
  });
  return r;
};

describe('views and responses', () => {
  it('rejects short or unknown tokens', async () => {
    const r = seedProposal({ publicToken: 'short' });
    expect((await recordProposalView({ records: r, token: 'short', now: NOW })).ok).toBe(false);
    expect((await respondToProposal({ records: r, token: 'short', action: 'ACCEPT', now: NOW })).ok).toBe(false);
    expect((await recordProposalView({ records: seedProposal(), token: 'zzzzzzzzzzzzzzzzzzzzzz', now: NOW })).ok).toBe(false);
    expect((await proposalPageResponse({ records: r, settings: settingsFor(), token: undefined, now: NOW })).status).toBe(404);
  });

  it('records the first view and moves SENT to VIEWED', async () => {
    const r = seedProposal();
    await recordProposalView({ records: r, token: TOKEN, now: NOW });
    const later = new Date(NOW.getTime() + DAY);
    await recordProposalView({ records: r, token: TOKEN, now: later });
    expect(r.get('proposals', 'prop-1')).toMatchObject({ status: 'VIEWED', viewedAt: NOW.toISOString() });
  });

  it('does not count a preview of a draft', async () => {
    const r = seedProposal({ status: 'DRAFT', sentAt: null });
    await recordProposalView({ records: r, token: TOKEN, now: NOW });
    expect(r.get('proposals', 'prop-1')!.viewedAt).toBeNull();
    expect((await respondToProposal({ records: r, token: TOKEN, action: 'ACCEPT', now: NOW })).ok).toBe(false);
  });

  it('accepting wins the deal and adds a task', async () => {
    const r = seedProposal({ status: 'VIEWED', viewedAt: ago(1) });
    const res = await respondToProposal({ records: r, token: TOKEN, action: 'ACCEPT', comment: ' Let us go ', now: NOW });
    expect(res).toMatchObject({ ok: true, status: 'ACCEPTED' });
    expect(r.get('proposals', 'prop-1')).toMatchObject({ status: 'ACCEPTED', respondedAt: NOW.toISOString(), clientComment: 'Let us go' });
    expect(r.get('opportunities', 'opp-1')!.stage).toBe('CUSTOMER');
    expect(r.table('tasks')[0].title).toBe('Acme accepted the proposal');
    expect(r.table('taskTargets').map((t) => t.targetOpportunityId ?? t.targetPersonId)).toEqual(['opp-1', 'p-1']);

    // A second click changes nothing.
    const again = await respondToProposal({ records: r, token: TOKEN, action: 'DECLINE', now: NOW });
    expect(again.already).toBe(true);
    expect(r.get('proposals', 'prop-1')!.status).toBe('ACCEPTED');
    expect(r.table('tasks')).toHaveLength(1);
  });

  it('changes and decline set the status and a task, without touching the deal', async () => {
    const r = seedProposal();
    await respondToProposal({ records: r, token: TOKEN, action: 'changes', comment: 'Lower price please', now: NOW });
    expect(r.get('proposals', 'prop-1')).toMatchObject({ status: 'CHANGES_REQUESTED', clientComment: 'Lower price please', viewedAt: NOW.toISOString() });
    expect(r.table('tasks')[0].title).toBe('Revise proposal for Acme');

    await respondToProposal({ records: r, token: TOKEN, action: 'DECLINE', now: NOW });
    expect(r.get('proposals', 'prop-1')!.status).toBe('DECLINED');
    expect(r.table('tasks')[1].title).toBe('Acme declined the proposal');
    expect(r.get('opportunities', 'opp-1')!.stage).toBe('PROPOSAL');
  });

  it('answers the form post with a thank-you page', async () => {
    const r = seedProposal();
    const fields = parseRespondBody({ body: `t=${TOKEN}&action=ACCEPT&comment=Great+work` });
    expect(fields).toEqual({ t: TOKEN, action: 'ACCEPT', comment: 'Great work' });
    const page = await proposalRespondResponse({ records: r, fields, now: NOW });
    expect(page.status).toBe(200);
    expect(page.html).toContain('Thank you!');
    expect(parseRespondBody({ body: { t: TOKEN, action: 'DECLINE' } })).toEqual({ t: TOKEN, action: 'DECLINE' });
    expect(parseRespondBody({ body: null, rawBody: Buffer.from(`{"t":"${TOKEN}"}`).toString('base64'), isBase64Encoded: true })).toEqual({ t: TOKEN });
    expect((await proposalRespondResponse({ records: r, fields: { t: TOKEN, action: 'MAYBE' }, now: NOW })).status).toBe(400);
  });
});

describe('follow-ups', () => {
  const base = { status: 'SENT' as const, respondedAt: null, followUpsSent: 0, lastFollowUpAt: null, viewedAt: null };

  it('is due 3 days after sending when unread and 5 days after the first view when read', () => {
    expect(followUpDue({ ...base, sentAt: ago(2.9) }, NOW)).toBe(false);
    expect(followUpDue({ ...base, sentAt: ago(3) }, NOW)).toBe(true);
    expect(followUpDue({ ...base, sentAt: ago(10), lastFollowUpAt: ago(2) }, NOW)).toBe(false);
    expect(followUpDue({ ...base, status: 'VIEWED', sentAt: ago(10), viewedAt: ago(4) }, NOW)).toBe(false);
    expect(followUpDue({ ...base, status: 'VIEWED', sentAt: ago(10), viewedAt: ago(5) }, NOW)).toBe(true);
    expect(followUpDue({ ...base, status: 'VIEWED', sentAt: ago(10), viewedAt: ago(9), lastFollowUpAt: ago(4) }, NOW)).toBe(false);
    expect(followUpDue({ ...base, sentAt: ago(30), followUpsSent: 2 }, NOW)).toBe(false);
    expect(followUpDue({ ...base, sentAt: ago(30), respondedAt: ago(1) }, NOW)).toBe(false);
  });

  it('drafts one follow-up with the link, never a duplicate, and a new angle the second time', async () => {
    const r = seedProposal({ sentAt: ago(4) });
    const writer = new FakeWriter([{ subject: 'Checking in', body: 'Hi Ada, did it arrive?' }]);
    const first = await proposalFollowUps({ records: r, writer, settings: settingsFor(), now: NOW });
    expect(first).toMatchObject({ drafted: 1, failed: 0 });
    const email = r.table('clientEmails')[0];
    expect(email).toMatchObject({ kind: 'PROPOSAL_FOLLOW_UP', proposalId: 'prop-1', toEmail: 'ada@acme.test', status: 'DRAFT' });
    expect(email.body).toContain(`https://fn.example.com/s/proposal?t=${TOKEN}`);

    // The draft is still waiting for approval: no second one.
    const second = await proposalFollowUps({ records: r, writer, settings: settingsFor(), now: NOW });
    expect(second.drafted).toBe(0);
    expect(r.table('clientEmails')).toHaveLength(1);

    // Sent; a week later the second (and last) follow-up takes another angle.
    email.status = 'SENT';
    Object.assign(r.get('proposals', 'prop-1')!, { followUpsSent: 1, lastFollowUpAt: ago(4) });
    await proposalFollowUps({ records: r, writer, settings: settingsFor(), now: NOW });
    expect(r.table('clientEmails')).toHaveLength(2);
    expect(writer.calls[1].prompt).toContain('second and last');

    r.table('clientEmails')[1].status = 'SENT';
    Object.assign(r.get('proposals', 'prop-1')!, { followUpsSent: 2, lastFollowUpAt: ago(10) });
    const third = await proposalFollowUps({ records: r, writer, settings: settingsFor(), now: NOW });
    expect(third.drafted).toBe(0);
  });
});

describe('public page', () => {
  it('escapes HTML in the body and renders the markdown subset', () => {
    const html = markdownToHtml('## Scope\n<script>alert(1)</script>\n\n- **Bold** item\n- [x](javascript:alert(1))\n\n| A | B |\n| --- | --- |\n| 1 | <b>2</b> |');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<h3>Scope</h3>');
    expect(html).toContain('<li><strong>Bold</strong> item</li>');
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('<td>&lt;b&gt;2&lt;/b&gt;</td>');
  });

  it('shows the amount and the answer form posting to the respond route', () => {
    const html = renderProposalPage(
      { name: 'Acme "proposal"', status: 'VIEWED', summary: null, body: '<img src=x onerror=alert(1)>', amount: 19000, publicToken: TOKEN },
      { name: 'Acme' },
      settingsFor(),
    );
    expect(html).toContain('$19,000');
    expect(html).toContain('action="https://fn.example.com/s/proposal/respond"');
    expect(html).toContain(`name="t" value="${TOKEN}"`);
    expect(html).toContain('Accept proposal');
    expect(html).toContain('Request changes');
    expect(html).not.toContain('<img');
    expect(html).toContain('Acme &quot;proposal&quot;');
  });

  it('hides the form once the proposal is accepted', () => {
    const html = renderProposalPage({ name: 'P', status: 'ACCEPTED', summary: null, body: '', amount: null, publicToken: TOKEN }, null, settingsFor());
    expect(html).not.toContain('<form');
    expect(html).toContain('You accepted this proposal');
  });

  it('serves the page and records the view', async () => {
    const r = seedProposal();
    const page = await proposalPageResponse({ records: r, settings: settingsFor(), token: TOKEN, now: NOW });
    expect(page.status).toBe(200);
    expect(page.html).toContain('Prepared for Acme');
    expect(r.get('proposals', 'prop-1')!.status).toBe('VIEWED');
  });
});
