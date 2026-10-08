// Production wiring for the qualification logic functions.

import { kv, runAgent } from 'twenty-sdk/logic-function';

import { LEAD_QUALIFIER_AGENT_UNIVERSAL_IDENTIFIER } from 'src/constants/qualify-ids';
import { writerFrom } from 'src/gtm/agency/ai';
import { enrichPerson } from 'src/gtm/prospeo/api';
import { ProspeoError } from 'src/gtm/prospeo/client';
import { enrichDatapoints, enrichedContact } from 'src/gtm/prospeo/people';
import { readDailyVerifications } from 'src/gtm/qualify/app-variables';
import { llmClassifier, type Classifier } from 'src/gtm/qualify/classify';
import { jevClassifier, jevClient, JEV_DEFAULT_MODEL } from 'src/gtm/qualify/jev';
import type { EmailVerifier, QualifyDeps } from 'src/gtm/qualify/run';
import { createQualifyStore } from 'src/gtm/qualify/twenty-store';
import { readThreshold } from 'src/gtm/qualify/values';
import { pickPageReader } from 'src/gtm/qualify/website';
import { PICKED_AI_MODEL_KV_KEY, resolveAiProvider, withPickedModel } from 'src/gtm/sequences/ai-models';
import { pickOpenerWriter } from 'src/gtm/sequences/opener-writers';

type Env = Record<string, string | undefined>;

const llm = (env: Env, model?: string): Classifier => {
  const e = model ? { ...env, AI_MODEL: model } : env;
  const provider = resolveAiProvider(e);
  const label = provider === 'twenty' ? 'Twenty AI' : `${provider}:${e.AI_MODEL?.trim() || 'default'}`;
  const writer = writerFrom((system, maxTokens) =>
    pickOpenerWriter(e, runAgent, LEAD_QUALIFIER_AGENT_UNIVERSAL_IDENTIFIER, undefined, { system, maxTokens }),
  );
  return llmClassifier(writer, label);
};

/**
 * Bulk and review classifiers from the variables:
 * - OpenRouter key set: Jev classifies everything; the review model (or the AI model) re-checks borderline results.
 * - No key: the AI model classifies everything; QUALIFY_REVIEW_MODEL, when set, re-checks borderline results.
 */
export const pickClassifiers = (env: Env): { bulk: Classifier; review: Classifier | null } => {
  const reviewModel = env.QUALIFY_REVIEW_MODEL?.trim() || undefined;
  const openrouter = env.OPENROUTER_API_KEY?.trim();
  if (openrouter) {
    return { bulk: jevClassifier(jevClient(openrouter), env.JEV_MODEL?.trim() || JEV_DEFAULT_MODEL), review: llm(env, reviewModel) };
  }
  return { bulk: llm(env), review: reviewModel ? llm(env, reviewModel) : null };
};

// Prospeo look-up with only verified emails. Null when Prospeo has no match.
const prospeoVerifier = (apiKey: string): EmailVerifier => async (person, company) => {
  const datapoints = enrichDatapoints({
    prospeoPersonId: person.prospeoPersonId,
    linkedinUrl: person.linkedinUrl,
    fullName: [person.firstName, person.lastName].filter(Boolean).join(' '),
    companyName: company?.name,
    companyDomain: company?.domain,
    email: person.email,
  });
  if (!datapoints) return null;
  try {
    const contact = enrichedContact(await enrichPerson(apiKey, datapoints));
    return { email: contact.email ?? null, verified: contact.emailVerified, prospeoPersonId: contact.personId ?? null };
  } catch (error) {
    if (error instanceof ProspeoError && error.isEmpty) return null;
    throw error;
  }
};

export const qualifyDeps = async (): Promise<QualifyDeps> => {
  const env = withPickedModel(process.env, await kv.get<string>(PICKED_AI_MODEL_KV_KEY).catch(() => null));
  const { bulk, review } = pickClassifiers(env);
  const prospeoKey = env.PROSPEO_API_KEY?.trim();
  return {
    store: createQualifyStore(),
    bulk,
    review,
    readPage: pickPageReader(env).read,
    verifyEmail: prospeoKey ? prospeoVerifier(prospeoKey) : null,
    threshold: readThreshold(env.QUALIFY_THRESHOLD),
    dailyVerifications: readDailyVerifications(env.QUALIFY_DAILY_VERIFICATIONS),
  };
};
