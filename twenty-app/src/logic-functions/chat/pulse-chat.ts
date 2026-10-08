import { defineLogicFunction } from 'twenty-sdk/define';

import { PULSE_CHAT_FUNCTION_UNIVERSAL_IDENTIFIER, PULSE_CHAT_ROUTE_PATH } from 'src/constants/chat-ids';
import { runChat, type ChatInput } from 'src/gtm/chat/agent';
import { chatDeps } from 'src/gtm/chat/runtime';
import { failure, toolOrRouteInput } from 'src/gtm/leadfinder/payload';

// Leaves room under the 300 s limit for the last answer.
const TIME_BUDGET_MS = 230_000;

// One chat turn on the user's own AI: the page sends the conversation so far,
// gets back the answer and the tools that ran.
export default defineLogicFunction({
  universalIdentifier: PULSE_CHAT_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'pulse-chat',
  description: 'Pulse chat: answers questions and works on CRM records with your own AI provider',
  timeoutSeconds: 300,
  httpRouteTriggerSettings: { path: PULSE_CHAT_ROUTE_PATH, httpMethod: 'POST', isAuthRequired: true },
  handler: async (payload: unknown) => {
    const started = Date.now();
    try {
      const { messages } = toolOrRouteInput<{ messages?: ChatInput[] }>(payload);
      const { model, tools } = await chatDeps();
      const result = await runChat({ model, tools, history: Array.isArray(messages) ? messages : [], deadline: started + TIME_BUDGET_MS });
      return { ok: true, model: model.label, ...result };
    } catch (error) {
      return failure(error);
    }
  },
});
