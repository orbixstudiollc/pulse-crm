"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { UIMessage } from "ai";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PlusIcon, GearIcon, TrashIcon, ClockIcon, BrainIcon, RobotIcon, FileTextIcon } from "@/components/ui";
import type { Tables } from "@/types/database";
import { deleteConversation } from "@/lib/actions/copilot";
import { listConversationMessages, listConversations } from "@/lib/actions/copilot-conversations";
import { ChatView } from "@/components/features/Copilot/ChatView";
import { ArtifactsView, type Artifact } from "@/components/features/Copilot/ArtifactsView";
import { PendingApprovals, type PendingApproval } from "@/components/features/Copilot/PendingApprovals";
import { MemoryView } from "@/components/features/Copilot/MemoryView";
import { TasksView } from "@/components/features/Copilot/TasksView";
import { SettingsView } from "@/components/features/Copilot/SettingsView";
import type { CopilotSettings } from "@/lib/actions/copilot-settings";
import type { UndoInfo } from "@/components/features/Copilot/UndoButton";

type Conversation = Awaited<ReturnType<typeof listConversations>>[number];
type MemoryItem = Tables<"copilot_memory">;
type CopilotTask = Tables<"copilot_tasks">;

export type CopilotView = "chat" | "artifacts" | "memory" | "tasks" | "settings";

/** The chat on screen: a stored conversation (id) or a new one (null). `key` remounts the chat. */
type ActiveChat = { id: string | null; messages: UIMessage[]; key: number };

interface CopilotClientProps {
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
}

const NAV_ITEMS: { id: CopilotView; label: string; icon: React.ReactNode }[] = [
  { id: "chat", label: "New chat", icon: <PlusIcon size={18} weight="bold" /> },
  { id: "artifacts", label: "Artifacts", icon: <FileTextIcon size={18} /> },
  { id: "memory", label: "Memory", icon: <BrainIcon size={18} /> },
  { id: "tasks", label: "Tasks", icon: <ClockIcon size={18} /> },
  { id: "settings", label: "Settings", icon: <GearIcon size={18} /> },
];

export function CopilotClient({
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
}: CopilotClientProps) {
  const [view, setView] = useState<CopilotView>(initialView);
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [chat, setChat] = useState<ActiveChat>({ id: initialConversationId, messages: initialMessages, key: 0 });
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>(initialMemory);
  const [tasks, setTasks] = useState<CopilotTask[]>(initialTasks);
  const [prompt, setPrompt] = useState<string | null>(initialPrompt);
  const openRequest = useRef(0);

  // Drop ?prompt= so a refresh does not send it again; the prompt itself lives in state.
  const router = useRouter();
  useEffect(() => {
    if (initialPrompt) router.replace("/dashboard/copilot");
  }, [initialPrompt, router]);

  const startNewChat = () => {
    openRequest.current++;
    setPrompt(null);
    setChat((current) => ({ id: null, messages: [], key: current.key + 1 }));
    setView("chat");
  };

  const openConversation = async (id: string) => {
    const request = ++openRequest.current;
    setView("chat");
    try {
      const messages = await listConversationMessages(id);
      if (request !== openRequest.current) return;
      setPrompt(null);
      setChat((current) => ({ id, messages, key: current.key + 1 }));
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
      setConversations(await listConversations());
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
                  "relative flex h-9 w-full items-center gap-2.5 px-4 text-[14px] text-fg transition-colors hover:bg-subtle [&_svg]:size-4",
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
                      "group relative flex h-10 w-full cursor-pointer items-center justify-between gap-2 px-4 text-[14px] border-b border-divider transition-colors hover:bg-subtle",
                      isOpen ? "font-medium text-fg" : "text-fg-secondary"
                    )}
                  >
                    {isOpen && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-sm bg-fg" />}
                    <span className="truncate text-left flex-1">{conv.title}</span>
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
        <PendingApprovals initialItems={initialPending} defaultOpen={approvalsOpen} />
        {view === "chat" ? (
          <ChatView
            key={chat.key}
            conversationId={chat.id}
            initialMessages={chat.messages}
            initialPrompt={prompt}
            onPromptSent={clearPrompt}
            onConversationCreated={handleConversationCreated}
            onUndo={handleUndo}
          />
        ) : view === "artifacts" ? (
          <ArtifactsView initialArtifacts={initialArtifacts} initialOpenId={initialArtifactId} />
        ) : view === "memory" ? (
          <MemoryView items={memoryItems} setItems={setMemoryItems} />
        ) : view === "tasks" ? (
          <TasksView tasks={tasks} setTasks={setTasks} />
        ) : (
          <SettingsView initial={initialSettings} onHistoryCleared={handleHistoryCleared} />
        )}
      </div>
    </div>
  );
}
