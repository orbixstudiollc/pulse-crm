import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction, type DatabaseEventPayload } from 'twenty-sdk/define';

import { DETECT_BOOKED_MEETINGS_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/replies-ids';
import { recordBookedMeeting } from 'src/gtm/replies/booking';
import { createBookingStore, fetchCalendarEvent } from 'src/gtm/replies/twenty-store';
import type { GraphqlClient } from 'src/gtm/sequences/twenty-store';

type ParticipantRecord = {
  calendarEventId?: string | null;
  personId?: string | null;
  handle?: string | null;
  isOrganizer?: boolean | null;
  workspaceMemberId?: string | null;
};

// Watches Twenty's calendar sync: a lead added as a guest to an upcoming event
// (a Calendly booking) moves their deal to Meeting.
const handler = async (event: DatabaseEventPayload) => {
  const after = (event.properties as { after?: ParticipantRecord }).after;
  if (!after?.calendarEventId) return { ok: true, skipped: 'No event' };
  try {
    const client = new CoreApiClient() as unknown as GraphqlClient;
    return await recordBookedMeeting({
      store: createBookingStore(client),
      participant: {
        personId: after.personId ?? null,
        handle: after.handle ?? null,
        isOrganizer: after.isOrganizer ?? null,
        workspaceMemberId: after.workspaceMemberId ?? null,
        event: await fetchCalendarEvent(client, after.calendarEventId),
      },
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: DETECT_BOOKED_MEETINGS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'detect-booked-meetings',
  description: 'Moves a lead\'s deal to Meeting when they are added to an upcoming calendar event',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: { eventName: 'calendarEventParticipant.created' },
});
