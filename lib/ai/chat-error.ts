const MAX_MESSAGE_LENGTH = 200;
// The current not-configured message, and the older "No AI API key ..." one.
const NEEDS_KEY = /ai isn't set up for this workspace|no ai api key/i;

export function describeChatError(err: unknown): { message: string; needsKey: boolean } {
  if (!(err instanceof Error)) {
    return { message: "Something went wrong. Please try again.", needsKey: false };
  }
  if (NEEDS_KEY.test(err.message)) {
    return { message: "Add an AI API key to use the assistant.", needsKey: true };
  }
  return { message: err.message.slice(0, MAX_MESSAGE_LENGTH), needsKey: false };
}
