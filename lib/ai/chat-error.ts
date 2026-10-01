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

const MAX_LOG_PART = 300;

/**
 * One short log line for a provider failure: error name, message, HTTP status,
 * host and the underlying cause. Never the request body (prompts, keys) and short
 * enough that the hosting log viewer does not truncate it.
 */
export function describeProviderError(err: unknown): string {
  if (!(err instanceof Error)) return String(err).slice(0, MAX_LOG_PART);
  const e = err as Error & { statusCode?: number; url?: string; cause?: unknown; responseBody?: string };
  const parts = [`${e.name}: ${e.message}`.slice(0, MAX_LOG_PART)];
  if (typeof e.statusCode === "number") parts.push(`status=${e.statusCode}`);
  if (typeof e.url === "string") {
    try {
      parts.push(`host=${new URL(e.url).host}`);
    } catch {
      // not a URL; skip
    }
  }
  const cause = e.cause as (Error & { code?: string }) | undefined;
  if (cause instanceof Error) {
    parts.push(`cause=${cause.name}: ${cause.message}${cause.code ? ` (${cause.code})` : ""}`.slice(0, MAX_LOG_PART));
  } else if (cause !== undefined) {
    parts.push(`cause=${String(cause).slice(0, MAX_LOG_PART)}`);
  }
  if (typeof e.responseBody === "string" && e.responseBody) {
    parts.push(`body=${e.responseBody.slice(0, 200)}`);
  }
  return parts.join(" | ");
}
