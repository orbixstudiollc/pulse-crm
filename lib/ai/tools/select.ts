// Which tools the model sees on a turn. Record-changing tools are over half of
// the tool payload (~14k of ~24k characters), so they are only offered when the
// turn can need them. Every tool stays registered for execution: an approved
// write always runs, whatever this selection says.

/** Words that ask Copilot to change records. */
const WRITE_INTENT =
  /\b(set|sets|create|add|new|update|edit|change|move|mark|convert|log|record|schedule|book|assign|follow[- ]?ups?|remind|reminder|rename|close|won|lost|stage|status|note|notes|tag|fix|correct|reassign|reschedule|complete|done)\b/i;

/** A short reply that accepts an offer ("yes", "do it", "go ahead"). */
const AFFIRMATIVE = /^(yes|yeah|yep|yup|sure|ok|okay|go|go ahead|do it|please|please do|confirm|confirmed|sounds good|y)\b/i;

/** The previous assistant reply offered to do something. */
const OFFER = /\b(want me to|shall i|should i|would you like me to|do you want me to|i can (also )?(set|update|create|move|add|log|mark|schedule|convert))\b/i;

const AFFIRMATIVE_MAX_LENGTH = 60;

export type ToolSelectionInput = {
  /** Every registered tool name. */
  allTools: readonly string[];
  /** Record-changing tool names (offered only when the turn can need them). */
  writeTools: readonly string[];
  /** The new user message, or null on an approval turn. */
  messageText: string | null;
  /** True when this request answers approval cards. */
  answeringApprovals: boolean;
  /** Text of the latest assistant message before this turn, if any. */
  lastAssistantText: string | null;
  /** Tool names used in the history the model will see. */
  historyToolNames: readonly string[];
};

export function wantsWriteTools(input: Omit<ToolSelectionInput, "allTools" | "writeTools" | "historyToolNames">): boolean {
  if (input.answeringApprovals) return true;
  const text = input.messageText?.trim() ?? "";
  if (!text) return false;
  if (WRITE_INTENT.test(text)) return true;
  return (
    text.length <= AFFIRMATIVE_MAX_LENGTH &&
    AFFIRMATIVE.test(text) &&
    input.lastAssistantText !== null &&
    OFFER.test(input.lastAssistantText)
  );
}

/** The tool names to offer the model this turn. */
export function selectActiveTools(input: ToolSelectionInput): string[] {
  if (wantsWriteTools(input)) return [...input.allTools];
  const writes = new Set(input.writeTools);
  const used = new Set(input.historyToolNames);
  // Tools already called in the visible history stay defined, so the provider
  // never sees a tool call for a tool it was not given.
  return input.allTools.filter((name) => !writes.has(name) || used.has(name));
}
