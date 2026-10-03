// Production wiring shared by the agency logic functions.

import { kv, runAgent } from 'twenty-sdk/logic-function';

import { AGENCY_WRITER_AGENT_UNIVERSAL_IDENTIFIER } from 'src/constants/agency-ids';
import { writerFrom, type AgencyWriter } from 'src/gtm/agency/ai';
import { createRecords, type Records } from 'src/gtm/agency/gql';
import { readAgencySettings, type AgencySettings } from 'src/gtm/agency/settings';
import { createTwentyClientMailer } from 'src/gtm/agency/twenty-mailer';
import type { ClientMailer } from 'src/gtm/agency/send-client-email';
import { PICKED_AI_MODEL_KV_KEY, withPickedModel } from 'src/gtm/sequences/ai-models';
import { pickOpenerWriter } from 'src/gtm/sequences/opener-writers';

export const agencySettings = (): AgencySettings => readAgencySettings(process.env);

export const agencyRecords = (): Records => createRecords();

export const agencyWriter = async (): Promise<AgencyWriter> => {
  const env = withPickedModel(process.env, await kv.get<string>(PICKED_AI_MODEL_KV_KEY).catch(() => null));
  return writerFrom((system, maxTokens) =>
    pickOpenerWriter(env, runAgent, AGENCY_WRITER_AGENT_UNIVERSAL_IDENTIFIER, undefined, { system, maxTokens }),
  );
};

export const agencyMailer = (records: Records, settings: AgencySettings): Promise<ClientMailer | null> =>
  createTwentyClientMailer(records, settings.clientEmailFrom);

export const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
