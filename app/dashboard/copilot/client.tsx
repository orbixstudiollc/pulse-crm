"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { UIMessage } from "ai";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PlusIcon, GearIcon, TrashIcon, ClockIcon, BrainIcon, RobotIcon, FileTextIcon } from "@/components/ui";
import type { Tables } from "@/types/database";
import { deleteConversation, getMemoryItems, getCopilotTasks } from "@/lib/actions/copilot";
import { listConversationMessages, listConversations } from "@/lib/actions/copilot-conversations";
import { ChatView } from "@/components/features/Copilot/ChatView";
import { ArtifactsView, type Artifact } from "@/components/features/Copilot/ArtifactsView";
import { PendingApprovals, type PendingApproval } from "@/components/features/Copilot/PendingApprovals";
import { MemoryView } from "@/components/features/Copilot/MemoryView";
import { TasksView } from "@/components/features/Copilot/TasksView";
import { SettingsView } from "@/components/features/Copilot/SettingsView";
import type { CopilotSettings } from "@/lib/actions/copilot-settings";
import type { AssistantBrief } from "@/lib/actions/copilot-brief";
import type { UndoInfo } from "@/components/features/Copilot/UndoButton";
import { listPendingApprovalsAction } from "@/lib/actions/copilot-approvals";
import { TwentyMemory } from "@/components/features/Twenty/TwentyMemory";
import { TwentyWorkflows } from "@/components/features/Twenty/TwentyWorkflows";

type Conversation = Awaited<ReturnType<typeof listConversations>>[number];
type MemoryItem = Tables<"copilot_memory">;
type CopilotTask = Tables<"copilot_tasks">;

export type CopilotView = "chat" | "artifacts" | "memory" | "tasks" | "settings" | "twenty-workflows";

/** The chat on screen: a stored conversation (id) or a new one (null). `key` remounts the chat. */
type ActiveChat = { id: string | null; messages: UIMessage[]; key: number; crmSource?: "pulse" | "twenty"; connectionId?: string };

interface CopilotClientProps {
  initialSource?: "pulse" | "twenty";
  initialConnectionId?: string;
  initialConversations: Conversation[];
  initialConversationId: string | null;
  initialMessages: UIMessage[];
  initialMemory: MemoryItem[];
  initialTasks: CopilotTask[];
  initialPending: PendingApproval[];
  initialArtifacts: Artifact[];
  initialArtifactId: string | null;
  initialSettings: CopilotSettings | null;
  initialView: CopilotView;
  /** Deep link from Overview's ask box: ?prompt=<text> starts a new chat with it. */
  initialPrompt: string | null;
  /** Deep link from an approval notification: ?view=approvals opens the pending approvals strip. */
  approvalsOpen: boolean;
  /** The "Today" counts for the new-chat start screen, or null when they could not be loaded. */
  brief: AssistantBrief | null;
}

const NAV_ITEMS: { id: CopilotView; label: string; icon: React.ReactNode }[] = [
  { id: "chat", label: "New chat", icon: <PlusIcon size={18} weight="bold" /> },
  { id: "artifacts", label: "Artifacts", icon: <FileTextIcon size={18} /> },
  { id: "memory", label: "Memory", icon: <BrainIcon size={18} /> },
  { id: "tasks", label: "Tasks", icon: <ClockIcon size={18} /> },
  { id: "twenty-workflows", label: "Twenty workflows", icon: <ClockIcon size={18} /> },
  { id: "settings", label: "Settings", icon: <GearIcon size={18} /> },
];

export function CopilotClient({
  initialSource,
  initialConnectionId,
  initialConversations,
  initialConversationId,
  initialMessages,
  initialMemory,
  initialTasks,
  initialPending,
  initialArtifacts,
  initialArtifactId,
  initialSettings,
  initialView,
  initialPrompt,
  approvalsOpen,
  brief,
}: CopilotClientProps) {
  const [view, setView] = useState<CopilotView>(initialView);
  const [chatBusy, setChatBusy] = useState(false);
  const [pendingItems, setPendingItems] = useState(initialPending);
  const [pendingVersion, setPendingVersion] = useState(0);
  const refreshPending = async () => {
    try { setPendingItems(await listPendingApprovalsAction()); setPendingVersion((value) => value + 1); }
    catch { toast.error("Could not refresh approvals"); }
  };
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const initialChat = initialConversations.find((item) => item.id === initialConversationId);
  const [chat, setChat] = useState<ActiveChat>({ id: initialConversationId, messages: initialMessages, key: 0, crmSource: initialChat?.crm_source ?? initialSource ?? "pulse", connectionId: initialChat?.integration_connection_id ?? initialConnectionId });
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>(initialMemory);
  const [tasks, setTasks] = useState<CopilotTask[]>(initialTasks);
  const [prompt, setPrompt] = useState<string | null>(initialPrompt);
  const openRequest = useRef(0);
  useEffect(() => {
    if (chat.crmSource === "twenty") return;
    let active = true;
    if (view === "memory") void getMemoryItems().then((result) => { if (active && result.data) setMemoryItems(result.data); });
    if (view === "tasks") void getCopilotTasks().then((result) => { if (active && result.data) setTasks(result.data); });
    return () => { active = false; };
  }, [view, chat.crmSource]);

  // Drop ?prompt= so a refresh does not send it again; the prompt itself lives in state.
  const router = useRouter();
  useEffect(() => {
    if (initialPrompt) {
      const url = new URL(window.location.href);
      url.searchParams.delete("prompt");
      url.searchParams.delete("c");
      url.searchParams.set("source", initialSource ?? "pulse");
      if (initialSource === "twenty" && initialConnectionId) url.searchParams.set("connection", initialConnectionId);
      else url.searchParams.delete("connection");
      router.replace(url.pathname + url.search);
    }
  }, [initialPrompt, initialSource, initialConnectionId, router]);

  const startNewChat = () => {
    openRequest.current++;
    setPrompt(null);
    setChat((current) => ({ id: null, messages: [], key: current.key + 1, crmSource: current.crmSource, connectionId: current.connectionId }));
    setView("chat");
  };

  const openConversation = async (id: string) => {
    const request = ++openRequest.current;
    setView("chat");
    try {
      const messages = await listConversationMessages(id);
      if (request !== openRequest.current) return;
      setPrompt(null);
      const conversation = conversations.find((item) => item.id === id);
      setChat((current) => ({ id, messages, key: current.key + 1, crmSource: conversation?.crm_source ?? "pulse", connectionId: conversation?.integration_connection_id ?? undefined }));
    } catch {
      toast.error("Could not open this chat");
    }
  };

  const handleDeleteConversation = async (id: string) => {
    const result = await deleteConversation(id);
    if ("error" in result) {
      toast.error("Could not delete this chat");
      return;
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (chat.id === id) startNewChat();
  };

  // The server creates a conversation on a new chat's first turn; adopt it without remounting.
  const handleConversationCreated = useCallback(async (id: string) => {
    setChat((current) => (current.id === null ? { ...current, id } : current));
    try {
      const rows = await listConversations();
      setConversations(rows);
      const stored = rows.find((item) => item.id === id);
      if (stored) setChat((current) => current.id === id ? { ...current, crmSource: stored.crm_source ?? "pulse", connectionId: stored.integration_connection_id ?? undefined } : current);
    } catch (error) {
      console.error("Copilot: refreshing the chat list failed:", error);
    }
  }, []);

  // Chat history was cleared in Settings: empty the list and leave any open chat for a fresh one.
  const handleHistoryCleared = useCallback(() => {
    openRequest.current++;
    setConversations([]);
    setPrompt(null);
    setChat((current) => ({ id: null, messages: [], key: current.key + 1 }));
  }, []);

  const handleUndo = useCallback((info: UndoInfo) => {
    if (info.tool === "save_memory") setMemoryItems((prev) => prev.filter((item) => item.id !== info.id));
  }, []);

  const clearPrompt = useCallback(() => setPrompt(null), []);

  return (
    <div className="flex h-full bg-surface max-md:flex-col">
      {/* Left column: conversation list (Clay Sculptor panel) */}
      <div className="w-64 shrink-0 border-r border-divider flex flex-col bg-surface max-md:w-full max-md:border-r-0 max-md:border-b max-md:max-h-56 max-md:overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-divider">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-fg-secondary">
            <RobotIcon size={18} />
          </div>
          <p className="text-[16px] leading-6 font-semibold text-fg">Pulse Copilot</p>
        </div>

        {/* Navigation */}
        <nav className="py-2">
          {NAV_ITEMS.map((item) => {
            const isActive = view === item.id && (item.id !== "chat" || chat.id === null);
            return (
              <button
                key={item.id}
                onClick={() => (item.id === "chat" ? startNewChat() : setView(item.id))}
                className={cn(
                  "relative flex h-9 w-full items-center gap-2.5 px-4 text-[13px] text-fg transition-colors hover:bg-subtle [&_svg]:size-4",
                  isActive ? "font-medium [&_svg]:text-fg" : "[&_svg]:text-fg-muted"
                )}
              >
                {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-sm bg-fg" />}
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto border-t border-divider">
          {conversations.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-fg-muted">No chat history yet</p>
              <p className="text-[13px] text-fg-muted mt-0.5">Start a new chat to begin</p>
            </div>
          ) : (
            <div>
              {conversations.map((conv) => {
                const isOpen = view === "chat" && chat.id === conv.id;
                return (
                  <div
                    key={conv.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => void openConversation(conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void openConversation(conv.id);
                    }}
                    className={cn(
                      "group relative flex h-10 w-full cursor-pointer items-center justify-between gap-2 px-4 text-[13px] border-b border-divider transition-colors hover:bg-subtle",
                      isOpen ? "font-medium text-fg" : "text-fg-secondary"
                    )}
                  >
                    {isOpen && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-sm bg-fg" />}
                    <span className="truncate text-left flex-1">{conv.crm_source === "twenty" ? "Twenty · " : ""}{conv.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteConversation(conv.id);
                      }}
                      aria-label="Delete chat"
                      className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-active transition-all"
                    >
                      <TrashIcon size={12} className="text-fg-muted" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <PendingApprovals key={pendingVersion} initialItems={pendingItems} defaultOpen={approvalsOpen || pendingVersion > 0} />
        <button type="button" className="self-end px-6 py-2 text-xs text-fg-muted underline" onClick={() => void refreshPending()}>Refresh approvals</button>
        {view === "chat" && <div className="flex items-center gap-3 border-b border-divider px-6 py-3">
          <label htmlFor="copilot-source" className="text-sm text-fg-secondary">CRM source</label>
          <select id="copilot-source" value={chat.crmSource ?? "pulse"} disabled={chatBusy || chat.id !== null || chat.messages.length > 0}
            className="rounded-md border border-divider bg-surface px-3 py-1 text-sm"
            onChange={(event) => {
              openRequest.current++; setPrompt(null);
              setChat((current) => ({ id: null, messages: [], key: current.key + 1, crmSource: event.target.value as "pulse" | "twenty" }));
            }}>
            <option value="pulse">Pulse</option><option value="twenty">Twenty</option>
          </select>
          {chat.id && <span className="text-xs text-fg-muted">Start a new chat to change the source.</span>}
        </div>}
        {view === "chat" ? (
          <ChatView
            key={chat.key}
            conversationId={chat.id}
            crmSource={chat.crmSource}
            connectionId={chat.connectionId}
            onBusyChange={setChatBusy}
            initialMessages={chat.messages}
            initialPrompt={prompt}
            onPromptSent={clearPrompt}
            onConversationCreated={handleConversationCreated}
            onUndo={handleUndo}
            brief={brief}
          />
        ) : view === "artifacts" ? (
          <ArtifactsView key={`${chat.crmSource}:${chat.connectionId}`} initialArtifacts={initialArtifacts.filter((item) => (item.crm_source ?? "pulse") === (chat.crmSource ?? "pulse") && (chat.crmSource !== "twenty" || !chat.connectionId || item.connection_id === chat.connectionId))} initialOpenId={initialArtifactId} crmSource={chat.crmSource} connectionId={chat.connectionId} />
        ) : view === "memory" ? (
          chat.crmSource === "twenty" ? <TwentyMemory connectionId={chat.connectionId} /> : <MemoryView items={memoryItems} setItems={setMemoryItems} />
        ) : view === "tasks" ? (
          chat.crmSource === "twenty" ? <TwentyWorkflows connectionId={chat.connectionId} onProposed={() => void refreshPending()} /> : <TasksView tasks={tasks} setTasks={setTasks} />
        ) : view === "twenty-workflows" ? (
          <div className="overflow-y-auto p-6"><TwentyWorkflows connectionId={chat.crmSource === "twenty" ? chat.connectionId : undefined} onProposed={() => void refreshPending()} /></div>
        ) : (
          <SettingsView initial={initialSettings} onHistoryCleared={handleHistoryCleared} />
        )}
      </div>
    </div>
  );
}
