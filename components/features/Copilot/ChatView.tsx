"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";
import type { AssistantBrief } from "@/lib/actions/copilot-brief";
import { AssistantHome } from "./AssistantHome";
import { ChatMessageParts } from "./ChatMessageParts";
import { Composer } from "./Composer";
import type { UndoInfo } from "./UndoButton";
import { chatErrorMessage, useCopilotChat, type ChatContext } from "./useCopilotChat";

const COPILOT_CONTEXT: ChatContext = { page: "Copilot" };
const PENDING_HINT = "Answer the pending changes first";

export type ChatViewProps = {
  /** The stored conversation to continue, or null for a new chat. */
  conversationId: string | null;
  initialMessages: UIMessage[];
  /** Sent once as the first message of a new chat (deep link from Overview). */
  initialPrompt?: string | null;
  onPromptSent?(): void;
  /** The server created a conversation for this chat's first turn. */
  onConversationCreated(id: string): void;
  /** A low-risk write (artifact or memory) made by Copilot was undone. */
  onUndo(info: UndoInfo): void;
  /** The "Today" counts for the start screen, or null when they could not be loaded. */
  brief: AssistantBrief | null;
};

export function ChatView({
  conversationId,
  initialMessages,
  initialPrompt,
  onPromptSent,
  onConversationCreated,
  onUndo,
  brief,
}: ChatViewProps) {
  const chat = useCopilotChat({ conversationId, pageKey: undefined, initialMessages, context: COPILOT_CONTEXT });
  const { messages, status, error, sendText, approve, deny, awaitingApproval } = chat;
  const isLoading = status === "submitted" || status === "streaming";

  const [draft, setDraft] = useState("");
  // The text of the turn in flight: a 4xx before streaming means the server never took it,
  // so it goes back into the composer for the user to resend.
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [seenError, setSeenError] = useState<unknown>(null);
  const [seenStatus, setSeenStatus] = useState(status);
  if (status !== seenStatus) {
    setSeenStatus(status);
    if (status === "streaming") setLastSent(null);
  }
  if (error !== seenError) {
    setSeenError(error);
    if (error && lastSent) {
      if (/turn_in_progress/.test(error.message) || chat.rejectedStatus !== null) {
        setDraft((current) => current || lastSent);
      }
      setLastSent(null);
    }
  }

  const handleSend = (text: string) => {
    if (!text.trim() || isLoading || awaitingApproval) return;
    setLastSent(text);
    sendText(text);
    setDraft("");
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createdId = chat.conversationId;
  const notifiedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!createdId || createdId === conversationId || notifiedIdRef.current === createdId) return;
    notifiedIdRef.current = createdId;
    onConversationCreated(createdId);
  }, [createdId, conversationId, onConversationCreated]);

  const promptSentRef = useRef(false);
  useEffect(() => {
    if (!initialPrompt || promptSentRef.current) return;
    promptSentRef.current = true;
    sendText(initialPrompt);
    onPromptSent?.();
  }, [initialPrompt, sendText, onPromptSent]);

  const chatError = error ? chatErrorMessage(error) : null;

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-10 max-sm:px-4">
        <div className="mx-auto w-full max-w-2xl">
          <h2 className="mb-6 text-center text-[22px] leading-7 font-semibold text-fg">What can I help with?</h2>
          <Composer value={draft} onChange={setDraft} onSend={() => handleSend(draft)} isLoading={isLoading} />
          {chatError && <ErrorLine error={chatError} className="mt-4" />}
          <AssistantHome brief={brief} onPick={handleSend} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6 max-sm:px-4">
        <div className="mx-auto max-w-3xl space-y-5">
          {messages.map((message, index) => (
            <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "min-w-0",
                  message.role === "user" ? "max-w-[75%] rounded-lg bg-accent-surface px-4 py-1" : "w-full",
                )}
              >
                <ChatMessageParts
                  message={message}
                  isLatest={index === messages.length - 1 && message.role === "assistant"}
                  onApprove={approve}
                  onDeny={deny}
                  onUndo={onUndo}
                  onPick={handleSend}
                  pickDisabled={isLoading || awaitingApproval}
                />
              </div>
            </div>
          ))}
          {status === "submitted" && (
            <div className="flex gap-1.5 py-2" aria-label="Pulse Copilot is thinking">
              <span className="h-2 w-2 animate-bounce rounded-full bg-fg-muted" style={{ animationDelay: "0ms" }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-fg-muted" style={{ animationDelay: "150ms" }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-fg-muted" style={{ animationDelay: "300ms" }} />
            </div>
          )}
          {chatError && <ErrorLine error={chatError} />}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="shrink-0 px-8 pb-6 pt-2 max-sm:px-4">
        <Composer
          value={draft}
          onChange={setDraft}
          onSend={() => handleSend(draft)}
          isLoading={isLoading}
          blockedReason={awaitingApproval ? PENDING_HINT : undefined}
        />
      </div>
    </div>
  );
}

function ErrorLine({ error, className }: { error: { message: string; needsKey: boolean }; className?: string }) {
  return (
    <div role="alert" className={cn("rounded-md border border-danger bg-danger-surface px-3 py-2 text-sm text-danger", className)}>
      {error.message}
      {error.needsKey && (
        <>
          {" "}
          <Link href="/dashboard/settings?tab=ai" className="font-medium underline">
            Open AI settings
          </Link>
        </>
      )}
    </div>
  );
}
