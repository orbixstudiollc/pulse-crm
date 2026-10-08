// Production wiring for the Pulse chat: the user's own AI provider, Twenty's
// REST API, and the Pulse lead actions.

import { RestApiClient } from 'twenty-client-sdk/rest';
import { kv } from 'twenty-sdk/logic-function';

import { pickChatModel } from 'src/gtm/chat/model';
import { chatTools, type PulseActions } from 'src/gtm/chat/tools';
import { createRecords } from 'src/gtm/agency/gql';
import { findLeads, type FindLeadsInput } from 'src/gtm/leadfinder/find';
import { enrollQualified, type EnrollQualifiedInput } from 'src/gtm/qualify/enroll';
import { startIcp, type StartIcpInput } from 'src/gtm/qualify/icp';
import { qualifyPending } from 'src/gtm/qualify/run';
import { qualifyDeps } from 'src/gtm/qualify/runtime';
import { createQualifyStore, qualificationCounts } from 'src/gtm/qualify/twenty-store';
import { PICKED_AI_MODEL_KV_KEY, withPickedModel } from 'src/gtm/sequences/ai-models';
import { createTwentyStore } from 'src/gtm/sequences/twenty-store';

const actions: PulseActions = {
  startIcp: (input) => startIcp(createRecords(), input as StartIcpInput),
  findLeads: (input) => findLeads(input as FindLeadsInput),
  qualifyLeads: async () => qualifyPending(await qualifyDeps()),
  qualificationStatus: async () => ({ ok: true, counts: await qualificationCounts() }),
  enrollQualified: (input) =>
    enrollQualified({ store: createQualifyStore(), sequences: createTwentyStore(), input: input as unknown as EnrollQualifiedInput }),
};

export const chatDeps = async () => {
  const env = withPickedModel(process.env, await kv.get<string>(PICKED_AI_MODEL_KV_KEY).catch(() => null));
  return { model: pickChatModel(env), tools: chatTools(new RestApiClient(), actions) };
};
