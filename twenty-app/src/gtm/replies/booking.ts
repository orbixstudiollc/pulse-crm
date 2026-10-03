// Booked-meeting detection. When Twenty's calendar sync adds a guest to an
// event (a Calendly booking lands on the host's Google Calendar), and that
// guest is a lead with a deal still at New or Screening, the deal moves to
// Meeting, the lead becomes Qualified and the campaign counts a meeting.
// Cancelled and past events are ignored, as is the organizer (us).

import type { LeadStatus } from 'src/gtm/lead-values';
import type { CampaignStatsDelta, EnrollmentRecord } from 'src/gtm/sequences/store';

export type BookingParticipant = {
  personId: string | null;
  handle: string | null;
  isOrganizer: boolean | null;
  workspaceMemberId: string | null;
  event: { id: string; title: string | null; startsAt: string | null; isCanceled: boolean | null } | null;
};

export type BookingOpportunity = { id: string; name: string | null; stage: string | null };

export interface BookingStore {
  findPersonIdByEmail(email: string): Promise<string | null>;
  getLeadStatus(personId: string): Promise<LeadStatus | null>;
  setLeadStatus(personId: string, status: LeadStatus): Promise<void>;
  // Open deals where this person is the point of contact.
  findOpportunities(personId: string): Promise<BookingOpportunity[]>;
  setOpportunityStage(id: string, stage: string): Promise<void>;
  findEnrollments(filter: { personIds: string[] }): Promise<EnrollmentRecord[]>;
  incrementCampaignStats(campaignId: string, delta: CampaignStatsDelta): Promise<void>;
}

export type BookingResult = {
  ok: true;
  skipped?: string;
  personId?: string;
  movedOpportunityIds?: string[];
};

const EARLY_STAGES = new Set(['NEW', 'SCREENING']);

export const recordBookedMeeting = async ({
  store,
  participant,
  now = new Date(),
}: {
  store: BookingStore;
  participant: BookingParticipant;
  now?: Date;
}): Promise<BookingResult> => {
  if (participant.isOrganizer || participant.workspaceMemberId) return { ok: true, skipped: 'Organizer or teammate' };
  const event = participant.event;
  if (!event || event.isCanceled) return { ok: true, skipped: 'No event or cancelled' };
  if (event.startsAt && new Date(event.startsAt).getTime() < now.getTime()) {
    return { ok: true, skipped: 'Event is in the past' };
  }

  const email = participant.handle?.trim().toLowerCase();
  const personId = participant.personId ?? (email ? await store.findPersonIdByEmail(email) : null);
  if (!personId) return { ok: true, skipped: 'Guest is not a person in the CRM' };

  const deals = (await store.findOpportunities(personId)).filter((o) => EARLY_STAGES.has(o.stage ?? ''));
  if (deals.length === 0) return { ok: true, skipped: 'No deal at New or Screening', personId };

  for (const deal of deals) await store.setOpportunityStage(deal.id, 'MEETING');

  const status = await store.getLeadStatus(personId);
  if (status !== 'CUSTOMER' && status !== 'QUALIFIED') await store.setLeadStatus(personId, 'QUALIFIED');

  // Credit the campaign of the sequence they replied to, once per booking.
  const replied = (await store.findEnrollments({ personIds: [personId] }))
    .filter((e) => e.status === 'REPLIED' && e.campaignId)
    .sort((a, b) => (b.repliedAt ?? '').localeCompare(a.repliedAt ?? ''))[0];
  if (replied?.campaignId) await store.incrementCampaignStats(replied.campaignId, { meetings: 1 });

  return { ok: true, personId, movedOpportunityIds: deals.map((d) => d.id) };
};
