const MAX_MESSAGE_LENGTH = 200;

export function describeChatError(err: unknown): { message: string; needsKey: boolean } {
  if (!(err instanceof Error)) {
    return { message: "Something went wrong. Please try again.", needsKey: false };
  }
  if (/no ai api key/i.test(err.message)) {
    return { message: "Add an AI API key to use the assistant.", needsKey: true };
  }
  return { message: err.message.slice(0, MAX_MESSAGE_LENGTH), needsKey: false };
}
