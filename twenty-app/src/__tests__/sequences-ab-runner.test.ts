import { beforeEach, describe, expect, it } from 'vitest';

import { FakeMailer, FakeStore } from 'src/__tests__/sequences-fakes';
import { assignVariant } from 'src/gtm/sequences/ab-testing';
import { enrollPeople } from 'src/gtm/sequences/enroll';
import { markReply } from 'src/gtm/sequences/mark-reply';
import { recordOpen } from 'src/gtm/sequences/record-open';
import { sendDueSteps } from 'src/gtm/sequences/send-due-steps';
import type { VariantRecord } from 'src/gtm/sequences/store';

const NOW = new Date('2026-10-01T09:00:00Z');
const VA = 'aaaaaaaa-0000-4000-8000-000000000001';
const VB = 'bbbbbbbb-0000-4000-8000-000000000002';

let store: FakeStore;
let mailer: FakeMailer;

const variant = (id: string, over: Partial<VariantRecord> = {}): VariantRecord & { stepId: string } => ({
  id,
  stepId: 's1',
  subject: `Subject ${id === VA ? 'A' : 'B'} for {{firstName}}`,
  body: `{{opener|Hello.}} Body ${id === VA ? 'A' : 'B'}`,
  weight: 50,
  isActive: true,
  isWinner: false,
  sent: 0,
  opened: 0,
  replied: 0,
  ...over,
});

const setup = (stepOver: Record<string, unknown> = {}, sequenceOver: Record<string, unknown> = {}) => {
  const variants = [...store.variants.values()];
  store.sequences.set('seq', {
    id: 'seq',
    name: 'AB',
    status: 'ACTIVE',
    businessDaysOnly: false,
    ...sequenceOver,
    steps: [
      {
        id: 's1',
        order: 1,
        delayDays: 0,
        type: 'EMAIL',
        template: { id: 't', subject: 'Template subject', body: 'Template body' },
        variants,
        ...stepOver,
      },
    ],
  });
};

const enroll = async (personId = 'p1') =>
  (await enrollPeople({ store, input: { personIds: [personId], sequenceId: 'seq' }, now: NOW })).enrolled[0]
    .enrollmentId;

beforeEach(() => {
  store = new FakeStore();
  mailer = new FakeMailer();
  for (let i = 1; i <= 3; i += 1) {
    store.people.set(`p${i}`, { id: `p${i}`, name: { firstName: `P${i}` }, emails: { primaryEmail: `p${i}@x.com` } });
  }
  store.variants.set(VA, variant(VA));
  store.variants.set(VB, variant(VB));
});

describe('A/B sends', () => {
  it('sends the hashed variant, counts it and credits the reply to it', async () => {
    setup();
    const id = await enroll();
    const expected = assignVariant([...store.variants.values()], id)!;
    await sendDueSteps({ store, mailer: mailer as any, now: NOW });

    const letter = expected.id === VA ? 'A' : 'B';
    expect(mailer.sent[0]).toMatchObject({ subject: `Subject ${letter} for P1`, text: `Hello. Body ${letter}` });
    expect(store.enrollments.get(id)?.lastVariantId).toBe(expected.id);
    expect(store.variants.get(expected.id)?.sent).toBe(1);

    await markReply({ store, input: { personId: 'p1', messageId: 'm' }, now: NOW });
    expect(store.variants.get(expected.id)?.replied).toBe(1);
  });

  it('falls back to the template for blank variant fields and adds the open pixel', async () => {
    store.variants.set(VA, variant(VA, { subject: ' ', weight: 100 }));
    store.variants.set(VB, variant(VB, { isActive: false }));
    setup();
    mailer.openTrackingUrl = 'https://t.test/open';
    const id = await enroll();
    await sendDueSteps({ store, mailer: mailer as any, now: NOW });
    expect(mailer.sent[0].subject).toBe('Template subject');
    expect(mailer.sent[0].html).toContain(`https://t.test/open?e=${id}&amp;v=${VA}`);
  });

  it('shifts every send to the winner once the sample is reached, and flags it', async () => {
    store.variants.set(VA, variant(VA, { sent: 60, replied: 1 }));
    store.variants.set(VB, variant(VB, { sent: 60, replied: 6 }));
    setup({ autoPickWinner: true, winnerMinSends: 50 });
    await enroll('p1');
    await enroll('p2');
    await enroll('p3');
    await sendDueSteps({ store, mailer: mailer as any, now: NOW });
    expect(mailer.sent.map((m) => m.text)).toEqual(['Hello. Body B', 'Hello. Body B', 'Hello. Body B']);
    expect(store.variants.get(VB)?.isWinner).toBe(true);
    expect(store.variants.get(VA)?.isWinner).toBe(false);
  });

  it('uses the enrollment opener and custom variables', async () => {
    store.variants.clear();
    setup({ template: { id: 't', subject: 'Hi', body: '{{opener|Hello.}} About {{painPoint|growth}}.' } });
    const id = await enroll();
    await store.updateEnrollment(id, { personalizedOpener: 'Saw your launch.' });
    store.enrollments.get(id)!.customVariables = { painPoint: 'churn' };
    await sendDueSteps({ store, mailer: mailer as any, now: NOW });
    expect(mailer.sent[0].text).toBe('Saw your launch. About churn.');
    expect(store.enrollments.get(id)?.lastVariantId).toBeNull();
  });
});

describe('require approved opener', () => {
  it('holds sends until the opener is approved', async () => {
    setup({}, { requireApprovedOpener: true });
    const id = await enroll();
    const first = await sendDueSteps({ store, mailer: mailer as any, now: NOW });
    expect(first).toMatchObject({ awaitingApproval: 1, sent: 0 });
    expect(store.enrollments.get(id)).toMatchObject({
      currentStep: 1,
      lastError: 'Waiting for an approved opener',
      nextSendAt: '2026-10-01T10:00:00.000Z',
    });

    await store.updateEnrollment(id, { openerStatus: 'APPROVED', personalizedOpener: 'Great podcast.' });
    const later = new Date('2026-10-01T10:00:00Z');
    expect(await sendDueSteps({ store, mailer: mailer as any, now: later })).toMatchObject({ sent: 1 });
    expect(mailer.sent[0].text.startsWith('Great podcast.')).toBe(true);
  });
});

describe('recordOpen', () => {
  const seen = () => {
    const m = new Map<string, unknown>();
    return { get: async (k: string) => m.get(k), set: async (k: string, v: unknown) => void m.set(k, v) };
  };

  it('counts one open per enrollment and variant, and ignores unknown ids', async () => {
    setup();
    const enrollmentId = 'eeeeeeee-0000-4000-8000-000000000001';
    store.enrollments.set(enrollmentId, {
      id: enrollmentId,
      personId: 'p1',
      sequenceId: 'seq',
      status: 'ACTIVE',
      currentStep: 2,
      nextSendAt: null,
    });
    const s = seen();
    expect(await recordOpen({ store, seen: s, enrollmentId, variantId: VA })).toBe('counted');
    expect(await recordOpen({ store, seen: s, enrollmentId, variantId: VA })).toBe('duplicate');
    expect(store.variants.get(VA)?.opened).toBe(1);
    expect(
      await recordOpen({ store, seen: s, enrollmentId: 'eeeeeeee-0000-4000-8000-000000000009', variantId: VA }),
    ).toBe('ignored');
    expect(await recordOpen({ store, seen: s, enrollmentId: 'not-a-uuid', variantId: VA })).toBe('ignored');
    expect(await recordOpen({ store, seen: s, enrollmentId, variantId: null })).toBe('ignored');
  });
});
