// Legacy text path only. This is NO LONGER the source of the model's history:
// the server owns conversation history in copilot_messages and loads it with
// loadUiMessages (lib/ai/history.ts). toChatMessages stays for the legacy
// text-only path, which still reads history from the client's request body.
//
// Builds the chat history sent to the model from the client's request body.
// Only user/assistant text survives: file and image parts would make the AI
// SDK fetch client-chosen URLs server-side, and system/tool roles would let a
// client override the Copilot's instructions or fake tool results.

export const MAX_CHAT_MESSAGES = 40;
export const MAX_CHAT_MESSAGE_CHARS = 20_000;

export type ChatMessage = { role: "user" | "assistant"; content: string };

type Part = { type?: unknown; text?: unknown };

function textOf(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p): p is Part => typeof p === "object" && p !== null)
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("");
}

export function toChatMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];

  const messages: ChatMessage[] = [];
  for (const msg of raw) {
    if (typeof msg !== "object" || msg === null) continue;
    const { role, content, parts } = msg as { role?: unknown; content?: unknown; parts?: unknown };
    if (role !== "user" && role !== "assistant") continue;

    const text = typeof content === "string" ? content : Array.isArray(content) ? textOf(content) : textOf(parts);
    if (!text.trim()) continue;

    messages.push({ role, content: text.slice(0, MAX_CHAT_MESSAGE_CHARS) });
  }
  return messages.slice(-MAX_CHAT_MESSAGES);
}
