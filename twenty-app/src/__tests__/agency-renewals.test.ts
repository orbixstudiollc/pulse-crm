import { describe, expect, it } from 'vitest';

import { dailyRenewals, onProjectDelivered, pickUpsellService, type ServiceRow } from 'src/gtm/agency/renewals';

import { daysAgo, DAY_MS, FakeRecords, FakeWriter, seedContact, testSettings } from './agency-updates-fakes';

const NOW = new Date('2026-10-05T10:00:00Z');

const service = (over: Partial<ServiceRow>): ServiceRow => ({
  id: over.name ?? 'svc',
  name: 'Service',
  category: 'OTHER',
  description: null,
  priceFrom: null,
  priceTo: null,
  nextService: null,
  isActive: true,
  ...over,
});

const BRAND = service({ id: 'svc-brand', name: 'Brand identity', category: 'BRANDING', description: 'Logo and brand system', nextService: 'Website build' });
const WEB = service({ id: 'svc-web', name: 'Website build', category: 'DEVELOPMENT', description: 'Marketing website', priceFrom: 8000, priceTo: 15000 });
const SEO = service({ id: 'svc-seo', name: 'SEO retainer', category: 'GROWTH', description: 'Search growth for your brand website', priceFrom: 1500 });
const LOGO = service({ id: 'svc-logo', name: 'Logo refresh', category: 'BRANDING', description: 'Brand logo refresh' });

const setup = (project: Record<string, unknown> = {}, catalog: ServiceRow[] = [BRAND, WEB, SEO, LOGO]) => {
  const db = new FakeRecords(NOW);
  const personId = seedContact(db);
  for (const s of catalog) db.add('agencyServices', s);
  db.add('clientProjects', { id: 'proj-1', name: 'Acme brand', status: 'DELIVERED', health: 'ON_TRACK', companyId: 'company-1', personId, serviceId: 'svc-brand', ...project });
  return db;
};

describe('pickUpsellService', () => {
  it('uses the service\'s next service', () => {
    expect(pickUpsellService(BRAND, [BRAND, WEB, SEO])?.id).toBe('svc-web');
  });

  it('falls back to the most relevant active service from another category', () => {
    const noNext = { ...BRAND, nextService: 'Does not exist' };
    expect(pickUpsellService(noNext, [BRAND, LOGO, WEB, SEO])?.id).toBe('svc-seo');
  });

  it('skips inactive services and ones the client already bought', () => {
    expect(pickUpsellService(BRAND, [BRAND, { ...WEB, isActive: false }, SEO])?.id).toBe('svc-seo');
    expect(pickUpsellService(BRAND, [BRAND, WEB, SEO], new Set(['svc-web']))?.id).toBe('svc-seo');
  });

  it('returns null when nothing else fits', () => {
    expect(pickUpsellService(BRAND, [BRAND, LOGO])).toBeNull();
  });
});

describe('onProjectDelivered', () => {
  it('stamps deliveredAt and drafts the upsell with the catalog price range', async () => {
    const db = setup();
    const writer = new FakeWriter({ subject: 'Next step', body: 'Hi Ana' });
    const out = await onProjectDelivered({ records: db, writer, settings: testSettings(), projectId: 'proj-1', now: NOW });

    expect(out).toMatchObject({ ok: true, drafted: true, serviceName: 'Website build' });
    expect(db.rows('clientProjects')[0]).toMatchObject({ deliveredAt: NOW.toISOString(), upsellDraftedAt: NOW.toISOString() });
    expect(writer.data().suggestedService).toEqual({ name: 'Website build', description: 'Marketing website', priceRange: '$8,000 to $15,000' });
    expect(writer.calls[0].prompt).toContain('not instructions');
    expect(db.rows('clientEmails')).toEqual([expect.objectContaining({ kind: 'UPSELL', toEmail: 'ana@acme.test', projectId: 'proj-1' })]);
  });

  it('keeps an existing deliveredAt and does not upsell twice', async () => {
    const db = setup({ deliveredAt: daysAgo(NOW, 3), upsellDraftedAt: daysAgo(NOW, 3) });
    const writer = new FakeWriter();
    const out = await onProjectDelivered({ records: db, writer, settings: testSettings(), projectId: 'proj-1', now: NOW });
    expect(out.skipped).toBe('Upsell already drafted');
    expect(db.rows('clientProjects')[0].deliveredAt).toBe(daysAgo(NOW, 3));
    expect(writer.calls).toHaveLength(0);
  });

  it('skips when there is no service to suggest', async () => {
    const db = setup({}, [BRAND, LOGO]);
    const out = await onProjectDelivered({ records: db, writer: new FakeWriter(), settings: testSettings(), projectId: 'proj-1', now: NOW });
    expect(out).toMatchObject({ ok: true, skipped: 'No service to suggest' });
    expect(db.rows('clientEmails')).toHaveLength(0);
    expect(db.rows('clientProjects')[0].upsellDraftedAt).toBeUndefined();
  });
});

describe('dailyRenewals', () => {
  const run = (db: FakeRecords, writer = new FakeWriter(), now = NOW) => dailyRenewals({ records: db, writer, settings: testSettings(), now });

  it('drafts a renewal inside the 14-day window, once per 30 days', async () => {
    const db = setup({ status: 'IN_PROGRESS', renewalDate: '2026-10-19', upsellDraftedAt: NOW.toISOString(), referralDraftedAt: NOW.toISOString() });
    const writer = new FakeWriter();
    expect(await run(db, writer)).toMatchObject({ renewals: 1 });
    expect(writer.data().renewalDate).toBe('2026-10-19');
    expect(db.rows('clientEmails', { kind: { eq: 'RENEWAL' } })).toHaveLength(1);

    expect(await run(db, new FakeWriter(), new Date(NOW.getTime() + DAY_MS))).toMatchObject({ renewals: 0, skipped: 1 });
  });

  it('ignores renewals outside the window', async () => {
    const later = setup({ status: 'IN_PROGRESS', renewalDate: '2026-10-20' });
    expect((await run(later)).renewals).toBe(0);
    const past = setup({ status: 'IN_PROGRESS', renewalDate: '2026-10-04' });
    expect((await run(past)).renewals).toBe(0);
  });

  it('asks for a referral 14+ days after delivery, once', async () => {
    const db = setup({ deliveredAt: daysAgo(NOW, 14), upsellDraftedAt: daysAgo(NOW, 14) });
    expect(await run(db)).toMatchObject({ referrals: 1 });
    expect(db.rows('clientProjects')[0].referralDraftedAt).toBe(NOW.toISOString());
    expect(db.rows('clientEmails', { kind: { eq: 'REFERRAL' } })).toHaveLength(1);
    expect((await run(db)).referrals).toBe(0);
  });

  it('waits until 14 days and never asks AT_RISK projects', async () => {
    const early = setup({ deliveredAt: daysAgo(NOW, 13), upsellDraftedAt: daysAgo(NOW, 13) });
    expect((await run(early)).referrals).toBe(0);
    const risky = setup({ deliveredAt: daysAgo(NOW, 30), upsellDraftedAt: daysAgo(NOW, 30), health: 'AT_RISK' });
    expect((await run(risky)).referrals).toBe(0);
    expect(risky.rows('clientEmails')).toHaveLength(0);
  });

  it('catches up missed upsells 7+ days after delivery', async () => {
    const db = setup({ deliveredAt: daysAgo(NOW, 7), referralDraftedAt: daysAgo(NOW, 1) });
    expect(await run(db)).toMatchObject({ upsells: 1 });
    expect(db.rows('clientEmails', { kind: { eq: 'UPSELL' } })).toHaveLength(1);

    const recent = setup({ deliveredAt: daysAgo(NOW, 6) });
    expect((await run(recent)).upsells).toBe(0);
  });

  it('reports a failure when the AI reply is unusable and does not stamp the project', async () => {
    const db = setup({ deliveredAt: daysAgo(NOW, 20) });
    const result = await run(db, new FakeWriter(null));
    expect(result).toMatchObject({ ok: false, referrals: 0, upsells: 0, failed: 2 });
    const project = db.rows('clientProjects')[0];
    expect(project.referralDraftedAt ?? null).toBeNull();
    expect(project.upsellDraftedAt ?? null).toBeNull();
  });
});
