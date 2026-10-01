"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";
import { describeChatError } from "@/lib/ai/chat-error";
import {
  SparkleIcon,
  ArrowUpIcon,
  CrosshairIcon,
  ChartBarIcon,
  EnvelopeIcon,
  LightningIcon,
  StarIcon,
  ShieldIcon,
  ChatCircleIcon,
} from "@/components/ui";
import { ChatMessageParts } from "./ChatMessageParts";
import type { UndoInfo } from "./UndoButton";
import { useCopilotChat, type ChatContext } from "./useCopilotChat";
import { SUGGESTION_CHIP } from "./styles";

const COPILOT_CONTEXT: ChatContext = { page: "Copilot" };

const SUGGESTION_CHIPS = [
  { label: "Find Ideal Prospects", icon: CrosshairIcon, color: "text-warning", prompt: "Help me find ideal prospects that match my ICP. Analyze my current leads and suggest the best profiles to target." },
  { label: "Generate a Full Campaign", icon: LightningIcon, color: "text-accent-strong", prompt: "Generate a full outreach campaign for my top leads. Include email sequences, follow-up timing, and personalization suggestions." },
  { label: "Write a Sequence", icon: EnvelopeIcon, color: "text-accent-strong", prompt: "Help me write an email sequence for lead outreach. I need a multi-step drip campaign." },
  { label: "Campaign Ideas", icon: StarIcon, color: "text-accent-strong", prompt: "Give me creative campaign ideas based on my current pipeline and leads. What strategies would work best?" },
  { label: "Weekly Analytics", icon: ChartBarIcon, color: "text-success", prompt: "Give me a weekly analytics summary. Include pipeline changes, lead activity, deals won/lost, and key metrics." },
  { label: "Best Performing Campaigns", icon: ChartBarIcon, color: "text-success", prompt: "Analyze my campaigns and tell me which ones are performing best. Include open rates, reply rates, and conversion metrics." },
  { label: "Get Advice", icon: ChatCircleIcon, color: "text-danger", prompt: "I need advice on my sales strategy. Review my pipeline and suggest improvements." },
  { label: "Audit My Workspace", icon: ShieldIcon, color: "text-success", prompt: "Audit my CRM workspace. Check for stale leads, stuck deals, missing follow-ups, and data quality issues." },
];

/** Short inline text for a failed turn; the server's own rejections get plain wording. */
function chatErrorMessage(error: Error): { message: string; needsKey: boolean } {
  if (/turn_in_progress/.test(error.message)) {
    return { message: "Another reply is still being written. Wait a moment, then send your message again.", needsKey: false };
  }
  if (/invalid_approval/.test(error.message)) {
    return { message: "That approval is no longer valid. The conversation was refreshed.", needsKey: false };
  }
  return describeChatError(error);
}

function Composer({
  value,
  onChange,
  onSend,
  isLoading,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
}) {
  return (
    <div data-clay-box className="mx-auto w-full max-w-3xl rounded-lg border border-line bg-surface shadow-card transition-colors focus-within:border-accent">
      <div className="flex items-start gap-2.5 px-4 pt-3.5">
        <SparkleIcon size={16} weight="fill" className="mt-0.5 shrink-0 text-accent" />
        <textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Ask Pulse AI or type / to see prompts..."
          aria-label="Message Pulse Copilot"
          className="flex-1 min-w-0 pb-1 text-[14px] leading-5 text-fg placeholder:text-fg-muted bg-transparent outline-none resize-none min-h-[40px]"
          rows={1}
          disabled={isLoading}
        />
      </div>
      <div className="flex items-center justify-end px-3 pb-3">
        <button
          onClick={onSend}
          disabled={!value.trim() || isLoading}
          aria-label="Send message"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-on-inverse transition-colors hover:bg-accent-strong disabled:opacity-40 disabled:hover:bg-accent"
        >
          <ArrowUpIcon size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}

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
};

export function ChatView({
  conversationId,
  initialMessages,
  initialPrompt,
  onPromptSent,
  onConversationCreated,
  onUndo,
}: ChatViewProps) {
  const chat = useCopilotChat({ conversationId, pageKey: undefined, initialMessages, context: COPILOT_CONTEXT });
  const { messages, status, error, sendText, approve, deny } = chat;
  const isLoading = status === "submitted" || status === "streaming";

  const [draft, setDraft] = useState("");
  // The text of the turn in flight: a 409 means the server never took it, so it goes back
  // into the composer for the user to resend.
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [seenError, setSeenError] = useState<unknown>(null);
  const [seenStatus, setSeenStatus] = useState(status);
  if (status !== seenStatus) {
    setSeenStatus(status);
    if (status === "streaming") setLastSent(null);
  }
  if (error !== seenError) {
    setSeenError(error);
    if (error && lastSent && /turn_in_progress/.test(error.message)) {
      setDraft((current) => current || lastSent);
      setLastSent(null);
    }
  }

  const handleSend = (text: string) => {
    if (!text.trim() || isLoading) return;
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
      <div className="flex flex-1 flex-col items-center justify-center px-8 max-sm:px-4">
        <h2 className="mb-6 text-[22px] leading-7 font-semibold text-fg">What can I help with?</h2>
        <div className="mb-6 w-full max-w-2xl">
          <Composer value={draft} onChange={setDraft} onSend={() => handleSend(draft)} isLoading={isLoading} />
        </div>
        {chatError && <ErrorLine error={chatError} className="mb-6 max-w-2xl" />}
        <div className="flex max-w-2xl flex-wrap justify-center gap-2">
          {SUGGESTION_CHIPS.map((chip) => (
            <button key={chip.label} onClick={() => handleSend(chip.prompt)} className={SUGGESTION_CHIP}>
              <chip.icon size={16} className={chip.color} weight="fill" />
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6 max-sm:px-4">
        <div className="mx-auto max-w-3xl space-y-5">
          {messages.map((message) => (
            <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "min-w-0",
                  message.role === "user" ? "max-w-[75%] rounded-lg bg-accent-surface px-4 py-1" : "w-full",
                )}
              >
                <ChatMessageParts message={message} onApprove={approve} onDeny={deny} onUndo={onUndo} />
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
        <Composer value={draft} onChange={setDraft} onSend={() => handleSend(draft)} isLoading={isLoading} />
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
