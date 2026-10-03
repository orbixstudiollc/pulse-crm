// ReplyStore and BookingStore on Twenty's workspace GraphQL API, reusing the
// sequences store for leads, tasks, enrollments and stats.

import { CoreApiClient } from 'twenty-client-sdk/core';

import type { BookingStore } from 'src/gtm/replies/booking';
import type { ReplyItem, ReplyPerson, ReplyStore } from 'src/gtm/replies/triage';
import { fetchSyncedMessage } from 'src/gtm/sequences/inbound';
import { createTwentyStore, type GraphqlClient } from 'src/gtm/sequences/twenty-store';

type Connection<T> = { edges?: { node: T }[] } | null | undefined;
const first = <T>(c: Connection<T>): T | null => c?.edges?.[0]?.node ?? null;
const nodes = <T>(c: Connection<T>): T[] => (c?.edges ?? []).map((e) => e.node);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const defaultClient = () => new CoreApiClient() as unknown as GraphqlClient;

export const createReplyStore = (client: GraphqlClient = defaultClient()): ReplyStore => {
  const base = createTwentyStore(client);
  return {
    setLeadStatus: base.setLeadStatus,
    createTask: base.createTask,
    getEnrollmentsByIds: base.getEnrollmentsByIds,
    updateEnrollment: base.updateEnrollment,
    incrementCampaignStats: base.incrementCampaignStats,
    incrementVariantStats: base.incrementVariantStats,

    async getInboxItem(id) {
      const res = await client.query({
        inboxItems: {
          __args: { filter: { id: { eq: id } }, first: 1 },
          edges: {
            node: {
              id: true,
              kind: true,
              subject: true,
              snippet: true,
              fromEmail: true,
              mailboxEmail: true,
              messageId: true,
              personId: true,
              enrollmentId: true,
              triagedAt: true,
            },
          },
        },
      });
      return first<ReplyItem>(res.inboxItems);
    },

    async getFullText(item) {
      // Twenty-synced replies keep the Twenty message id; IMAP ones a Message-ID.
      if (!item.messageId || !UUID.test(item.messageId)) return null;
      return (await fetchSyncedMessage(client, item.messageId))?.text ?? null;
    },

    async getPerson(id) {
      const res = await client.query({
        people: {
          __args: { filter: { id: { eq: id } }, first: 1 },
          edges: {
            node: {
              id: true,
              name: { firstName: true, lastName: true },
              emails: { primaryEmail: true },
              jobTitle: true,
              leadStatus: true,
              companyId: true,
              company: { name: true },
            },
          },
        },
      });
      const p = first<any>(res.people);
      if (!p) return null;
      return {
        id: p.id,
        firstName: p.name?.firstName || null,
        lastName: p.name?.lastName || null,
        email: p.emails?.primaryEmail || null,
        jobTitle: p.jobTitle || null,
        leadStatus: p.leadStatus ?? null,
        companyId: p.companyId ?? null,
        companyName: p.company?.name || null,
      } satisfies ReplyPerson;
    },

    async updateInboxItem(id, patch) {
      await client.mutation({ updateInboxItem: { __args: { id, data: patch }, id: true } });
    },

    async findOpenOpportunity(personId, companyId) {
      const who: Record<string, unknown>[] = [{ pointOfContactId: { eq: personId } }];
      if (companyId) who.push({ companyId: { eq: companyId } });
      const res = await client.query({
        opportunities: {
          __args: { filter: { and: [{ or: who }, { stage: { neq: 'CUSTOMER' } }] }, first: 1 },
          edges: { node: { id: true } },
        },
      });
      return first<{ id: string }>(res.opportunities)?.id ?? null;
    },

    async createOpportunity(data) {
      const res = await client.mutation({
        createOpportunity: {
          __args: {
            data: { name: data.name, pointOfContactId: data.personId, companyId: data.companyId, stage: 'NEW' },
          },
          id: true,
        },
      });
      return res.createOpportunity.id as string;
    },
  };
};

export const createBookingStore = (client: GraphqlClient = defaultClient()): BookingStore => {
  const base = createTwentyStore(client);
  return {
    setLeadStatus: base.setLeadStatus,
    findEnrollments: base.findEnrollments,
    incrementCampaignStats: base.incrementCampaignStats,

    async findPersonIdByEmail(email) {
      return (await base.findPersonByEmail(email))?.id ?? null;
    },

    async getLeadStatus(personId) {
      return (await base.getPeople([personId]))[0]?.leadStatus ?? null;
    },

    async findOpportunities(personId) {
      const res = await client.query({
        opportunities: {
          __args: { filter: { pointOfContactId: { eq: personId } }, first: 20 },
          edges: { node: { id: true, name: true, stage: true } },
        },
      });
      return nodes<{ id: string; name: string | null; stage: string | null }>(res.opportunities);
    },

    async setOpportunityStage(id, stage) {
      await client.mutation({ updateOpportunity: { __args: { id, data: { stage } }, id: true } });
    },
  };
};

export const fetchCalendarEvent = async (client: GraphqlClient, id: string) => {
  const res = await client.query({
    calendarEvents: {
      __args: { filter: { id: { eq: id } }, first: 1 },
      edges: { node: { id: true, title: true, startsAt: true, isCanceled: true } },
    },
  });
  return first<{ id: string; title: string | null; startsAt: string | null; isCanceled: boolean | null }>(res.calendarEvents);
};
