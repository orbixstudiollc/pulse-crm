"use client";

// Docked Copilot: a resizable right column on Leads, Deals and Inbox, plus the chat
// view it shares with the floating panel (AIChatPanel) on every other page. Only one
// of the two is mounted on a route, so a route has exactly one useCopilotChat.

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UIMessage } from "ai";
import { ArrowSquareOutIcon, PaperPlaneTiltIcon, SparkleIcon, XIcon } from "@/components/ui/Icons";
import { getPageConversation } from "@/lib/actions/copilot-conversations";
import { CHAT_ENTITY_TYPES } from "@/lib/ai/chat-request";
import { resolvePage } from "@/lib/ai/page-map";
import { startersFor, type PageStarter } from "@/lib/ai/page-starters";
import { ChatMessageParts } from "./ChatMessageParts";
import { useSelection } from "./SelectionContext";
import { chatErrorMessage, useCopilotChat, type ChatContext } from "./useCopilotChat";
import { useDockedPanel } from "./useDockedPanel";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SELECTED_IDS = 50;
const KEYBOARD_RESIZE_STEP = 16;
const MESSAGE_MAX_LENGTH = 8000;
const PENDING_HINT = "Answer the pending changes first";

type PageConversation = { id: string; messages: UIMessage[] };

/** The current page's key, label and request context (entity and selected ids). */
export function usePageChatContext() {
  const pathname = usePathname() ?? "";
  const selected = useSelection();
  const { pageKey, label, entityType, entityId } = resolvePage(pathname);
  const selectionKey = selected.filter((id) => UUID_RE.test(id)).slice(0, MAX_SELECTED_IDS).join(",");
  const context = useMemo<ChatContext>(() => {
    const ctx: ChatContext = { page: label };
    const type = CHAT_ENTITY_TYPES.find((t) => t === entityType);
    if (type && entityId) Object.assign(ctx, { entityType: type, entityId });
    if (selectionKey) ctx.selectedIds = selectionKey.split(",");
    return ctx;
  }, [label, entityType, entityId, selectionKey]);
  return { pageKey, label, context, selectionCount: context.selectedIds?.length ?? 0 };
}

/** Loads (or creates) the signed-in user's conversation for a page. */
export function usePageConversation(pageKey: string) {
  const [loaded, setLoaded] = useState<(PageConversation & { pageKey: string }) | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPageConversation(pageKey).then(
      (conversation) => {
        if (cancelled) return;
        setFailedKey(null);
        setLoaded({ ...conversation, pageKey });
      },
      (error) => {
        if (cancelled) return;
        console.error("Copilot: loading the page conversation failed:", error);
        setFailedKey(pageKey);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [pageKey, attempt]);

  return {
    conversation: loaded?.pageKey === pageKey ? loaded : null,
    failed: failedKey === pageKey,
    retry: () => setAttempt((n) => n + 1),
  };
}

type CopilotChatViewProps = {
  conversation: PageConversation;
  pageKey: string;
  context: ChatContext;
  starters: PageStarter[];
};

/** Messages, starter chips and composer over one useCopilotChat instance. */
export function CopilotChatView({ conversation, pageKey, context, starters }: CopilotChatViewProps) {
  const chat = useCopilotChat({
    conversationId: conversation.id,
    pageKey,
    initialMessages: conversation.messages,
    context,
  });
  const [draft, setDraft] = useState("");
  // The text of the turn in flight: a 4xx before streaming means the server never took it,
  // so it goes back into the composer for the user to resend.
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [seenError, setSeenError] = useState<Error | undefined>(undefined);
  const [seenStatus, setSeenStatus] = useState(chat.status);
  const listRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const busy = chat.status === "submitted" || chat.status === "streaming";
  const blocked = chat.awaitingApproval === true;

  if (chat.status !== seenStatus) {
    setSeenStatus(chat.status);
    if (chat.status === "streaming") setLastSent(null);
  }
  if (chat.error !== seenError) {
    setSeenError(chat.error);
    if (chat.error && lastSent) {
      if (/turn_in_progress/.test(chat.error.message) || chat.rejectedStatus != null) {
        setDraft((current) => current || lastSent);
      }
      setLastSent(null);
    }
  }

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [chat.messages]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy || blocked) return;
    setLastSent(trimmed);
    setDraft("");
    chat.sendText(trimmed);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(draft);
    }
  };
  const error = chat.error ? chatErrorMessage(chat.error) : null;

  return (
    <div data-copilot-chat className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {chat.messages.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-fg-muted">Ask Copilot about this page.</p>
        ) : (
          chat.messages.map((message, index) =>
            message.role === "user" ? (
              <div key={message.id} className="border-t border-divider py-2 first:border-t-0">
                <p className="whitespace-pre-wrap text-[14px] font-medium leading-6 text-fg">
                  {message.parts.map((part) => (part.type === "text" ? part.text : "")).join("")}
                </p>
              </div>
            ) : (
              <ChatMessageParts
                key={message.id}
                message={message}
                isLatest={index === chat.messages.length - 1}
                onApprove={chat.approve}
                onDeny={chat.deny}
                onUndo={() => undefined}
              />
            ),
          )
        )}
        {chat.status === "submitted" && <p className="py-2 text-[13px] text-fg-muted">Thinking…</p>}
      </div>

      {chat.notice && <p className="border-t border-divider px-4 py-2 text-[13px] text-fg-muted">{chat.notice}</p>}
      {error && (
        <p role="alert" className="border-t border-divider px-4 py-2 text-[13px] text-danger">
          {error.message}
          {error.needsKey && (
            <>
              {" "}
              <Link href="/dashboard/settings?tab=ai" className="font-medium underline">
                Open AI settings
              </Link>
            </>
          )}
        </p>
      )}

      {starters.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-divider px-4 py-2">
          {starters.map((starter) => (
            <button
              key={starter.label}
              type="button"
              disabled={busy || blocked}
              onClick={() => send(starter.prompt)}
              className="h-7 rounded-md border border-line px-2.5 text-[13px] text-fg hover:bg-subtle disabled:opacity-50"
            >
              {starter.label}
            </button>
          ))}
        </div>
      )}

      {blocked && (
        <p id={hintId} className="border-t border-divider px-4 py-2 text-[13px] text-fg-muted">
          {PENDING_HINT}
        </p>
      )}
      <form
        className="flex items-end gap-2 border-t border-divider p-3"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="Ask Copilot…"
          aria-label="Message Copilot"
          aria-describedby={blocked ? hintId : undefined}
          maxLength={MESSAGE_MAX_LENGTH}
          className="max-h-[120px] min-h-9 flex-1 resize-none rounded-md border border-line bg-surface px-3 py-2 text-[14px] text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {busy ? (
          <button
            type="button"
            onClick={chat.stop}
            className="h-8 shrink-0 rounded-md border border-line px-3 text-[13px] text-fg hover:bg-subtle"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!draft.trim() || blocked}
            aria-label="Send"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-inverse hover:opacity-90 disabled:opacity-50"
          >
            <PaperPlaneTiltIcon className="h-4 w-4 text-on-inverse" />
          </button>
        )}
      </form>
    </div>
  );
}

/** Loads the page conversation, then mounts the chat view. */
export function PageCopilotChat({
  pageKey,
  context,
  starters,
  onConversation,
}: {
  pageKey: string;
  context: ChatContext;
  starters: PageStarter[];
  onConversation?: (id: string | null) => void;
}) {
  const { conversation, failed, retry } = usePageConversation(pageKey);
  const conversationId = conversation?.id ?? null;
  useEffect(() => {
    onConversation?.(conversationId);
  }, [onConversation, conversationId]);

  if (conversation) {
    return (
      <CopilotChatView
        key={conversation.id}
        conversation={conversation}
        pageKey={pageKey}
        context={context}
        starters={starters}
      />
    );
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-[13px] text-fg-muted">
      {failed ? (
        <>
          <p>Could not load the conversation.</p>
          <button type="button" onClick={retry} className="font-medium text-fg underline">
            Retry
          </button>
        </>
      ) : (
        <p>Loading…</p>
      )}
    </div>
  );
}

/** The dashboard content column; padded on the right while the dock is open (lg and up). */
export function DockedContent({ children }: { children: ReactNode }) {
  const { isDockedRoute, open, width } = useDockedPanel();
  const docked = isDockedRoute && open;
  return (
    <div
      className={`flex flex-1 flex-col overflow-hidden${docked ? " lg:pr-(--copilot-dock-width)" : ""}`}
      style={docked ? ({ "--copilot-dock-width": `${width}px` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}

export function DockedCopilot() {
  const { isDockedRoute, open, width, minWidth, maxWidth, toggle, setWidth } = useDockedPanel();
  if (!isDockedRoute || !open) return null;
  return (
    <DockColumn width={width} minWidth={minWidth} maxWidth={maxWidth} onClose={toggle} onResize={setWidth} />
  );
}

type DockColumnProps = {
  width: number;
  minWidth: number;
  maxWidth: number;
  onClose(): void;
  onResize(width: number, options?: { persist?: boolean }): void;
};

type Drag = { pointerId: number; startX: number; startWidth: number; width: number };

function DockColumn({ width, minWidth, maxWidth, onClose, onResize }: DockColumnProps) {
  const { pageKey, label, context, selectionCount } = usePageChatContext();
  const starters = useMemo(() => startersFor(pageKey, { count: selectionCount }), [pageKey, selectionCount]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const columnId = useId();
  const dragRef = useRef<Drag | null>(null);

  // The handle captures the pointer, so its own handlers see the whole drag; React drops
  // them on unmount. The width is stored once, when the drag ends.
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width, width };
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.width = drag.startWidth + (drag.startX - event.clientX);
    onResize(drag.width, { persist: false });
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.type === "pointercancel") onResize(drag.startWidth, { persist: false });
    else onResize(drag.width);
  };
  const resizeByKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const next: Record<string, number> = {
      ArrowLeft: width + KEYBOARD_RESIZE_STEP,
      ArrowRight: width - KEYBOARD_RESIZE_STEP,
      Home: minWidth,
      End: maxWidth,
    };
    if (!(event.key in next)) return;
    event.preventDefault();
    onResize(next[event.key]);
  };

  return (
    <aside
      id={columnId}
      aria-label="Copilot"
      style={{ width }}
      className="absolute inset-y-0 right-0 z-20 flex flex-col border-l border-divider bg-surface max-md:w-full!"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize Copilot"
        aria-controls={columnId}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={resizeByKey}
        className="absolute inset-y-0 -left-1 w-2 cursor-col-resize touch-none hover:bg-divider focus:outline-none focus-visible:bg-divider focus-visible:ring-2 focus-visible:ring-accent max-md:hidden"
      />
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-divider px-4">
        <SparkleIcon className="h-4 w-4 text-fg" weight="fill" />
        <span className="text-[14px] font-semibold text-fg">Copilot</span>
        <span className="truncate text-[13px] text-fg-muted">{label}</span>
        <div className="ml-auto flex items-center gap-1">
          {conversationId && (
            <Link
              href={`/dashboard/copilot?c=${conversationId}`}
              className="flex h-7 items-center gap-1 rounded-md px-2 text-[13px] text-fg-secondary hover:bg-subtle"
            >
              Continue in Copilot
              <ArrowSquareOutIcon className="h-3.5 w-3.5" />
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Copilot"
            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-subtle"
          >
            <XIcon className="h-3.5 w-3.5 text-fg-secondary" />
          </button>
        </div>
      </div>
      <PageCopilotChat pageKey={pageKey} context={context} starters={starters} onConversation={setConversationId} />
    </aside>
  );
}
