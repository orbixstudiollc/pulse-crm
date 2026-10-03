import { describe, expect, it } from 'vitest';

import { recordBookedMeeting, type BookingParticipant, type BookingStore } from 'src/gtm/replies/booking';
import type { EnrollmentRecord } from 'src/gtm/sequences/store';

const NOW = new Date('2026-10-03T12:00:00Z');

const makeStore = () => {
  const state = {
    status: 'HOT' as any,
    stages: new Map<string, string>([['o1', 'NEW'], ['o2', 'PROPOSAL']]),
    meetings: 0,
  };
  const store: BookingStore = {
    findPersonIdByEmail: async (email) => (email === 'ada@acme.com' ? 'p1' : null),
    getLeadStatus: async () => state.status,
    setLeadStatus: async (_id, s) => { state.status = s; },
    findOpportunities: async () => [...state.stages].map(([id, stage]) => ({ id, name: id, stage })),
    setOpportunityStage: async (id, stage) => { state.stages.set(id, stage); },
    findEnrollments: async () => [
      { id: 'e1', personId: 'p1', sequenceId: 's', campaignId: 'c1', status: 'REPLIED', currentStep: 2, nextSendAt: null, repliedAt: '2026-10-02' } as EnrollmentRecord,
    ],
    incrementCampaignStats: async (_id, d) => { state.meetings += d.meetings ?? 0; },
  };
  return { store, state };
};

const guest = (o: Partial<BookingParticipant> = {}): BookingParticipant => ({
  personId: null,
  handle: 'Ada@Acme.com',
  isOrganizer: false,
  workspaceMemberId: null,
  event: { id: 'ev', title: 'Ada and John (1hr)', startsAt: '2026-10-06T15:00:00Z', isCanceled: false },
  ...o,
});

describe('recordBookedMeeting', () => {
  it('moves early deals to Meeting, qualifies the lead and counts a meeting', async () => {
    const { store, state } = makeStore();
    const r = await recordBookedMeeting({ store, participant: guest(), now: NOW });
    expect(r.movedOpportunityIds).toEqual(['o1']);
    expect(state.stages.get('o1')).toBe('MEETING');
    expect(state.stages.get('o2')).toBe('PROPOSAL');
    expect(state.status).toBe('QUALIFIED');
    expect(state.meetings).toBe(1);
  });

  it('ignores organizers, teammates, cancelled and past events, and strangers', async () => {
    for (const p of [
      guest({ isOrganizer: true }),
      guest({ workspaceMemberId: 'wm' }),
      guest({ event: { id: 'e', title: null, startsAt: '2026-10-06T00:00:00Z', isCanceled: true } }),
      guest({ event: { id: 'e', title: null, startsAt: '2026-09-01T00:00:00Z', isCanceled: false } }),
      guest({ handle: 'nobody@x.com' }),
    ]) {
      const { store, state } = makeStore();
      expect((await recordBookedMeeting({ store, participant: p, now: NOW })).skipped).toBeTruthy();
      expect(state.stages.get('o1')).toBe('NEW');
    }
  });
});
