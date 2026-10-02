import { defineLogicFunction } from 'twenty-sdk/define';
import { kv } from 'twenty-sdk/logic-function';

import { AI_MODELS_FUNCTION_UNIVERSAL_IDENTIFIER, AI_MODELS_ROUTE_PATH } from 'src/constants/sequences-ids';
import { fetchModels, PICKED_AI_MODEL_KV_KEY, resolveAiProvider } from 'src/gtm/sequences/ai-models';
import { toolOrRouteInput } from 'src/gtm/leadfinder/payload';

type AiModelsInput = { action?: 'status' | 'list' | 'select' | 'clear'; model?: string };

// Route behind the Pulse settings tab on Apps > Pulse GTM: lists the provider's models and
// stores the picked one (it overrides the AI model variable).
const handler = async (payload: unknown) => {
  const input = toolOrRouteInput<AiModelsInput>(payload);
  try {
    if (input.action === 'select') {
      const model = input.model?.trim();
      if (!model) return { ok: false, error: 'No model given' };
      await kv.set(PICKED_AI_MODEL_KV_KEY, model);
    } else if (input.action === 'clear') {
      await kv.delete(PICKED_AI_MODEL_KV_KEY);
    }
    const picked = (await kv.get<string>(PICKED_AI_MODEL_KV_KEY)) ?? null;
    const variable = process.env.AI_MODEL?.trim() || null;
    const status = { provider: resolveAiProvider(process.env), picked, variable, current: picked ?? variable };
    if (input.action !== 'list') return { ok: true, ...status };
    return { ok: true, ...status, models: await fetchModels(process.env) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: AI_MODELS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'ai-models',
  description: 'List the models the configured AI provider offers, and pick the one used to write openers.',
  timeoutSeconds: 30,
  httpRouteTriggerSettings: {
    path: AI_MODELS_ROUTE_PATH,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
  handler,
});
