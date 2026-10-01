"use client";

// Client runtime for Copilot chat over POST /api/ai/chat.
//
// The server owns the conversation history, so a request carries one human action
// only: a new message OR the answers to the latest assistant message's approval
// cards, never both and never the message history (lib/ai/chat-request.ts).

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  generateId,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import type { ChatRequestContext } from "@/lib/ai/chat-request";
import type { ApprovalResponse } from "@/lib/ai/approvals";
import { listConversationMessages } from "@/lib/actions/copilot-conversations";
import { describeChatError } from "@/lib/ai/chat-error";

export type ChatContext = ChatRequestContext;

/** Wire body of one chat request; keys match chatRequestSchema exactly. */
export type CopilotRequestBody = {
  conversationId: string | undefined;
  pageKey: string | undefined;
  context: ChatContext | undefined;
  message: { text: string } | undefined;
  approvals: ApprovalResponse[];
};

const CHAT_API = "/api/ai/chat";

/** The answers given to the newest assistant message's approval cards that the server has not seen yet. */
export function approvalResponsesFromLastAssistant(messages: UIMessage[]): ApprovalResponse[] {
  const last = messages.findLast((m) => m.role === "assistant");
  if (!last) return [];
  return last.parts.flatMap((part) => {
    if (!isToolUIPart(part) || part.state !== "approval-responded") return [];
    const { id, approved, reason } = part.approval;
    return [reason ? { approvalId: id, approved, reason } : { approvalId: id, approved }];
  });
}

/**
 * True while the newest message is the assistant's and some of its approval cards are
 * unanswered. A new message sent then would carry no approvals, so the composers wait.
 */
export function hasUnansweredApprovals(messages: UIMessage[]): boolean {
  const last = messages.at(-1);
  if (last?.role !== "assistant") return false;
  return last.parts.some((part) => isToolUIPart(part) && part.state === "approval-requested");
}

const ERROR_TEXT: Record<string, string> = {
  turn_in_progress: "Another reply is still being written. Wait a moment, then send your message again.",
  invalid_approval: "That approval is no longer valid. The conversation was refreshed.",
  conversation_not_found: "This conversation no longer exists. Start a new chat.",
  invalid_request: "Copilot could not read that message. Shorten it and try again.",
};
const GENERIC_REJECTION = "Copilot could not take that message. Please try again.";
const ERROR_CODE = /^[a-z_]+$/;

/** The `error` field of a JSON rejection body, if the error text is one. */
function rejectionError(text: string): string | null {
  try {
    const body = JSON.parse(text) as { error?: unknown } | null;
    return typeof body?.error === "string" ? body.error : null;
  } catch {
    return null; // Plain text, not a JSON body.
  }
}

/** Short inline text for a failed turn: plain wording for the server's rejections, never raw JSON. */
export function chatErrorMessage(error: Error): { message: string; needsKey: boolean } {
  const known = Object.keys(ERROR_TEXT).find((code) => error.message.includes(code));
  if (known) return { message: ERROR_TEXT[known], needsKey: false };
  const rejection = rejectionError(error.message);
  if (rejection === null) return describeChatError(error);
  if (ERROR_CODE.test(rejection)) return { message: GENERIC_REJECTION, needsKey: false };
  return describeChatError(new Error(rejection));
}

/** Text of the last message when it is a user message the server has not stored yet. */
function lastUserTextIfNew(messages: UIMessage[]): string | undefined {
  const last = messages.at(-1);
  if (last?.role !== "user") return undefined;
  const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  return text || undefined;
}

/** Builds the request body: a new user message, or else the approval answers. */
export function copilotRequestBody(
  messages: UIMessage[],
  scope: { conversationId: string | null; pageKey?: string; context?: ChatContext },
): CopilotRequestBody {
  const text = lastUserTextIfNew(messages);
  return {
    conversationId: scope.conversationId ?? undefined,
    pageKey: scope.pageKey,
    context: scope.context,
    message: text ? { text } : undefined,
    approvals: text ? [] : approvalResponsesFromLastAssistant(messages),
  };
}

/** Responses after which the client's copy of the conversation is out of date. */
async function needsReload(response: Response): Promise<boolean> {
  if (response.status === 409) return true;
  if (response.status !== 400) return false;
  try {
    const body = (await response.clone().json()) as { error?: unknown };
    return body?.error === "invalid_approval";
  } catch {
    return false; // Not a JSON body, so not the invalid_approval rejection.
  }
}

function noticeText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const { message, code } = data as { message?: unknown; code?: unknown };
  if (typeof message === "string" && message) return message;
  return typeof code === "string" ? code : null;
}

export function useCopilotChat(args: {
  conversationId: string | null;
  pageKey?: string;
  initialMessages: UIMessage[];
  context?: ChatContext;
}) {
  const [conversationId, setConversationId] = useState(args.conversationId);
  const [notice, setNotice] = useState<string | null>(null);
  // A different conversation passed in by the caller starts a fresh chat; the id the
  // server assigns on the first turn does not.
  const [chatId, setChatId] = useState(() => args.conversationId ?? generateId());
  const [seenArgId, setSeenArgId] = useState(args.conversationId);
  if (args.conversationId !== seenArgId) {
    setSeenArgId(args.conversationId);
    if (args.conversationId !== conversationId) {
      setConversationId(args.conversationId);
      setChatId(args.conversationId ?? generateId());
      setNotice(null);
    }
  }

  // The transport is created once, so it reads the current values through refs.
  const conversationIdRef = useRef(conversationId);
  const scopeRef = useRef({ pageKey: args.pageKey, context: args.context });
  const reloadRef = useRef<() => Promise<void>>(async () => undefined);
  const dropOptimisticRef = useRef<() => void>(() => undefined);
  // Whether the request in flight carries a new user message (not approval answers).
  const sendsMessageRef = useRef(false);
  // HTTP status of a 4xx rejection since the last sendText: the server stored nothing.
  const [rejectedStatus, setRejectedStatus] = useState<number | null>(null);
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);
  useEffect(() => {
    scopeRef.current = { pageKey: args.pageKey, context: args.context };
  }, [args.pageKey, args.context]);

  const [transport] = useState(
    // eslint-disable-next-line react-hooks/refs -- the refs are read when a request is sent, never during render
    () =>
      new DefaultChatTransport<UIMessage>({
        api: CHAT_API,
        prepareSendMessagesRequest: ({ messages }) => {
          const body = copilotRequestBody(messages, { conversationId: conversationIdRef.current, ...scopeRef.current });
          sendsMessageRef.current = body.message !== undefined;
          return { body };
        },
        fetch: async (input, init) => {
          const response = await globalThis.fetch(input, init);
          const id = response.headers.get("x-conversation-id");
          if (id && id !== conversationIdRef.current) {
            conversationIdRef.current = id;
            setConversationId(id);
          }
          if (response.status >= 400 && response.status < 500) {
            setRejectedStatus(response.status);
            // The server never stored the message, so its optimistic copy goes too.
            if (sendsMessageRef.current) dropOptimisticRef.current();
          }
          if (await needsReload(response)) {
            reloadRef.current().catch((error) => console.error("Copilot: reloading the conversation failed:", error));
          }
          return response;
        },
      }),
  );

  const chat = useChat({
    id: chatId,
    messages: args.initialMessages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onData: (part) => {
      if (part.type === "data-notice") setNotice(noticeText(part.data));
    },
  });
  const { setMessages, sendMessage, addToolApprovalResponse, stop } = chat;

  const reloadFromServer = useCallback(async () => {
    const id = conversationIdRef.current;
    if (!id) return;
    const messages = await listConversationMessages(id);
    if (conversationIdRef.current === id) setMessages(messages);
  }, [setMessages]);
  useEffect(() => {
    reloadRef.current = reloadFromServer;
    dropOptimisticRef.current = () =>
      setMessages((messages) => (messages.at(-1)?.role === "user" ? messages.slice(0, -1) : messages));
  }, [reloadFromServer, setMessages]);

  const sendText = useCallback(
    (text: string) => {
      setNotice(null);
      setRejectedStatus(null);
      void sendMessage({ text });
    },
    [sendMessage],
  );
  const approve = useCallback(
    (approvalId: string) => void addToolApprovalResponse({ id: approvalId, approved: true }),
    [addToolApprovalResponse],
  );
  const deny = useCallback(
    (approvalId: string, reason?: string) => void addToolApprovalResponse({ id: approvalId, approved: false, reason }),
    [addToolApprovalResponse],
  );
  const stopChat = useCallback(() => void stop(), [stop]);

  return {
    messages: chat.messages,
    status: chat.status,
    error: chat.error,
    rejectedStatus,
    awaitingApproval: hasUnansweredApprovals(chat.messages),
    sendText,
    approve,
    deny,
    conversationId,
    notice,
    stop: stopChat,
    reloadFromServer,
  };
}
