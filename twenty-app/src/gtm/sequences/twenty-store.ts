// SequenceStore backed by Twenty's workspace GraphQL API (genql-style requests
// through twenty-client-sdk's CoreApiClient, which logic functions get
// authenticated automatically).
//
// Unverified against a live server: field and mutation names follow Twenty's
// generated schema conventions (plural queries with edges/node, create<X>,
// update<X>, relation `foo` exposed as `fooId` on input).

import { CoreApiClient } from 'twenty-client-sdk/core';

import {
  pickEnrollmentPatch,
  type CampaignStatsDelta,
  type EnrollmentPatch,
  type EnrollmentRecord,
  type NewEnrollment,
  type NewInboxItem,
  type NewTask,
  type PersonRecord,
  type SequenceRecord,
  type SequenceStore,
  type StepRecord,
} from 'src/gtm/sequences/store';
import type { LeadStatus } from 'src/gtm/lead-values';

export type GraphqlClient = {
  query: (request: Record<string, unknown>) => Promise<any>;
  mutation: (request: Record<string, unknown>) => Promise<any>;
};

type Connection<T> = { edges?: { node: T }[] } | null | undefined;
const nodes = <T>(c: Connection<T>): T[] => (c?.edges ?? []).map((e) => e.node);

const PERSON_SELECTION = {
  id: true,
  name: { firstName: true, lastName: true },
  emails: { primaryEmail: true },
  jobTitle: true,
  city: true,
  leadStatus: true,
  company: { name: true, domainName: { primaryLinkUrl: true } },
};

const ENROLLMENT_SELECTION = {
  id: true,
  personId: true,
  sequenceId: true,
  campaignId: true,
  status: true,
  currentStep: true,
  nextSendAt: true,
  lastSentAt: true,
  repliedAt: true,
  stopReason: true,
  mailboxEmail: true,
  lastError: true,
};

type RawEnrollment = Omit<EnrollmentRecord, 'currentStep'> & { currentStep: number | null };

const toEnrollment = (raw: RawEnrollment): EnrollmentRecord => ({
  ...raw,
  currentStep: raw.currentStep && raw.currentStep > 0 ? raw.currentStep : 1,
});

export const createTwentyStore = (
  client: GraphqlClient = new CoreApiClient() as unknown as GraphqlClient,
): SequenceStore => ({
  async findDueEnrollments(now, limit) {
    const res = await client.query({
      sequenceEnrollments: {
        __args: {
          filter: { status: { eq: 'ACTIVE' }, nextSendAt: { lte: now.toISOString() } },
          orderBy: [{ nextSendAt: 'AscNullsLast' }],
          first: limit,
        },
        edges: { node: ENROLLMENT_SELECTION },
      },
    });
    return nodes<RawEnrollment>(res.sequenceEnrollments).map(toEnrollment);
  },

  async findEnrollments({ personIds, sequenceId, activeOnly }) {
    const and: Record<string, unknown>[] = [];
    if (personIds) and.push({ personId: { in: personIds } });
    if (sequenceId) and.push({ sequenceId: { eq: sequenceId } });
    if (activeOnly) and.push({ status: { eq: 'ACTIVE' } });
    const res = await client.query({
      sequenceEnrollments: {
        __args: { filter: and.length ? { and } : {}, first: 1000 },
        edges: { node: ENROLLMENT_SELECTION },
      },
    });
    return nodes<RawEnrollment>(res.sequenceEnrollments).map(toEnrollment);
  },

  async createEnrollment(data: NewEnrollment) {
    const res = await client.mutation({
      createSequenceEnrollment: {
        __args: {
          data: {
            name: data.name,
            personId: data.personId,
            sequenceId: data.sequenceId,
            campaignId: data.campaignId ?? null,
            status: data.status,
            currentStep: data.currentStep,
            nextSendAt: data.nextSendAt,
            stopReason: data.stopReason ?? null,
          },
        },
        id: true,
      },
    });
    return res.createSequenceEnrollment.id as string;
  },

  async updateEnrollment(id: string, patch: EnrollmentPatch) {
    const data = pickEnrollmentPatch(patch);
    if (Object.keys(data).length === 0) return;
    await client.mutation({ updateSequenceEnrollment: { __args: { id, data }, id: true } });
  },

  async getSequence(id: string): Promise<SequenceRecord | null> {
    const res = await client.query({
      sequences: {
        __args: { filter: { id: { eq: id } }, first: 1 },
        edges: {
          node: {
            id: true,
            name: true,
            status: true,
            businessDaysOnly: true,
            steps: {
              __args: { first: 100 },
              edges: {
                node: {
                  id: true,
                  stepOrder: true,
                  delayDays: true,
                  stepType: true,
                  instructions: true,
                  template: { id: true, subject: true, body: true },
                },
              },
            },
          },
        },
      },
    });
    const raw = nodes<any>(res.sequences)[0];
    if (!raw) return null;
    const steps = nodes<any>(raw.steps).map(
      (s): StepRecord => ({
        id: s.id,
        order: s.stepOrder ?? null,
        delayDays: s.delayDays ?? null,
        type: s.stepType ?? null,
        instructions: s.instructions ?? null,
        template: s.template ?? null,
      }),
    );
    return { ...raw, steps };
  },

  async getPeople(ids: string[]) {
    if (ids.length === 0) return [];
    const res = await client.query({
      people: {
        __args: { filter: { id: { in: ids } }, first: ids.length },
        edges: { node: PERSON_SELECTION },
      },
    });
    return nodes<PersonRecord>(res.people);
  },

  async findPersonByEmail(email: string) {
    const res = await client.query({
      people: {
        __args: { filter: { emails: { primaryEmail: { ilike: email } } }, first: 1 },
        edges: { node: PERSON_SELECTION },
      },
    });
    return nodes<PersonRecord>(res.people)[0] ?? null;
  },

  async setLeadStatus(personId: string, status: LeadStatus) {
    await client.mutation({
      updatePerson: { __args: { id: personId, data: { leadStatus: status } }, id: true },
    });
  },

  async incrementCampaignStats(campaignId: string, delta: CampaignStatsDelta) {
    const res = await client.query({
      campaigns: {
        __args: { filter: { id: { eq: campaignId } }, first: 1 },
        edges: { node: { id: true, enrolled: true, sent: true, replied: true, meetings: true } },
      },
    });
    const current = nodes<Record<string, number | null>>(res.campaigns)[0];
    if (!current) return;
    const data: Record<string, number> = {};
    for (const [key, inc] of Object.entries(delta)) {
      if (inc) data[key] = (current[key] ?? 0) + inc;
    }
    if (Object.keys(data).length === 0) return;
    await client.mutation({ updateCampaign: { __args: { id: campaignId, data }, id: true } });
  },

  async hasInboxItemForMessage(messageId: string) {
    const res = await client.query({
      inboxItems: {
        __args: { filter: { messageId: { eq: messageId } }, first: 1 },
        edges: { node: { id: true } },
      },
    });
    return nodes(res.inboxItems).length > 0;
  },

  async createInboxItem(data: NewInboxItem) {
    const res = await client.mutation({
      createInboxItem: { __args: { data: { ...data, status: 'UNREAD' } }, id: true },
    });
    return res.createInboxItem.id as string;
  },

  async createTask(data: NewTask) {
    const base = { title: data.title.slice(0, 250), dueAt: data.dueAt, status: 'TODO' };
    let res: any;
    try {
      res = await client.mutation({
        createTask: {
          __args: {
            data: data.body ? { ...base, bodyV2: { markdown: data.body } } : base,
          },
          id: true,
        },
      });
    } catch {
      // Older/newer schemas name the body differently; the title is enough.
      res = await client.mutation({ createTask: { __args: { data: base }, id: true } });
    }
    const taskId = res.createTask.id as string;
    await client.mutation({
      createTaskTarget: {
        __args: { data: { taskId, targetPersonId: data.personId } },
        id: true,
      },
    });
    return taskId;
  },
});
