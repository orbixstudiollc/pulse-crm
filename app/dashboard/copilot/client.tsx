"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { describeChatError } from "@/lib/ai/chat-error";
import { toast } from "sonner";
import {
  SparkleIcon,
  PlusIcon,
  GearIcon,
  TrashIcon,
  PencilSimpleIcon,
  CheckIcon,
  XIcon,
  ClockIcon,
  GlobeIcon,
  BrainIcon,
  PaperPlaneTiltIcon,
  ArrowUpIcon,
  CrosshairIcon,
  ChartBarIcon,
  EnvelopeIcon,
  LightningIcon,
  StarIcon,
  ShieldIcon,
  ChatCircleIcon,
  RobotIcon,
} from "@/components/ui";
import { Page, PageHeader, Section, EmptyState } from "@/components/dashboard";
import type { Tables } from "@/types/database";
import {
  createConversation,
  deleteConversation,
  updateConversation,
  saveMessage,
  getMessages,
  createMemoryItem,
  updateMemoryItem,
  deleteMemoryItem,
  scrapeWebsiteForMemory,
  createCopilotTask,
  updateCopilotTask,
  deleteCopilotTask,
} from "@/lib/actions/copilot";

type Conversation = Tables<"copilot_conversations">;
type MemoryItem = Tables<"copilot_memory">;
type CopilotTask = Tables<"copilot_tasks">;

type CopilotView = "chat" | "memory" | "tasks" | "settings";

// Helper to extract text from UIMessage parts
function getMessageText(msg: { parts?: Array<{ type: string; text?: string }>; content?: string }): string {
  if (msg.parts) {
    return msg.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text" && !!p.text)
      .map(p => p.text)
      .join("");
  }
  return (msg as { content?: string }).content || "";
}

// Clay control recipes shared by the Memory, Tasks and Settings views.
const BTN_PRIMARY = "inline-flex h-8 items-center gap-1.5 rounded-md bg-accent-strong px-3 text-[14px] font-medium text-on-inverse transition-colors hover:bg-accent-strong/90 disabled:opacity-50";
const BTN_OUTLINE = "inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[14px] font-medium text-fg transition-colors hover:bg-subtle";
const BTN_GHOST = "inline-flex h-8 items-center rounded-md px-3 text-[14px] font-medium text-fg-secondary transition-colors hover:bg-subtle hover:text-fg";
const FIELD = "w-full rounded-md border border-line bg-surface px-3 text-[14px] text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none";
const LABEL = "mb-1.5 block text-[13px] font-medium text-fg";
const SUGGESTION_CHIP = "inline-flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-3 text-[13px] font-medium text-fg transition-colors hover:bg-subtle";

interface CopilotClientProps {
  initialConversations: Conversation[];
  initialMemory: MemoryItem[];
  initialTasks: CopilotTask[];
}

// ── Main Copilot Client ────────────────────────────────────────────────────

export function CopilotClient({ initialConversations, initialMemory, initialTasks }: CopilotClientProps) {
  const [view, setView] = useState<CopilotView>("chat");
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>(initialMemory);
  const [tasks, setTasks] = useState<CopilotTask[]>(initialTasks);

  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  const handleNewChat = async () => {
    const result = await createConversation();
    if (result.data) {
      setConversations(prev => [result.data!, ...prev]);
      setActiveConversationId(result.data.id);
      setInitialPrompt(null);
      setView("chat");
    }
  };

  const handleSendFromEmpty = async (prompt: string) => {
    const result = await createConversation();
    if (result.data) {
      setConversations(prev => [result.data!, ...prev]);
      setActiveConversationId(result.data.id);
      setInitialPrompt(prompt);
      setView("chat");
    }
  };

  // Deep link from Overview's ask box: /dashboard/copilot?prompt=<text>.
  // Start one chat with it, then drop the param so a refresh does not resend.
  const router = useRouter();
  const searchParams = useSearchParams();
  const promptParamHandled = useRef(false);

  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (!prompt || promptParamHandled.current) return;
    promptParamHandled.current = true;
    router.replace("/dashboard/copilot");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state updates happen after the awaited createConversation, not synchronously
    void handleSendFromEmpty(prompt);
  }, [searchParams, router]);

  const handleDeleteConversation = async (id: string) => {
    await deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) setActiveConversationId(null);
  };

  const navItems: { id: CopilotView; label: string; icon: React.ReactNode }[] = [
    { id: "chat", label: "New chat", icon: <PlusIcon size={18} weight="bold" /> },
    { id: "memory", label: "Memory", icon: <BrainIcon size={18} /> },
    { id: "tasks", label: "Tasks", icon: <ClockIcon size={18} /> },
    { id: "settings", label: "Settings", icon: <GearIcon size={18} /> },
  ];

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
          {navItems.map(item => {
            const isActive = view === item.id && !activeConversationId;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "chat") {
                    handleNewChat();
                  } else {
                    setView(item.id);
                    setActiveConversationId(null);
                  }
                }}
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
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setActiveConversationId(conv.id);
                    setView("chat");
                  }}
                  onKeyDown={e => { if (e.key === "Enter") { setActiveConversationId(conv.id); setView("chat"); } }}
                  className={cn(
                    "group relative flex h-10 w-full cursor-pointer items-center justify-between gap-2 px-4 text-[14px] border-b border-divider transition-colors hover:bg-subtle",
                    activeConversationId === conv.id
                      ? "font-medium text-fg"
                      : "text-fg-secondary"
                  )}
                >
                  {activeConversationId === conv.id && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-sm bg-fg" />
                  )}
                  <span className="truncate text-left flex-1">{conv.title}</span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-active transition-all"
                  >
                    <TrashIcon size={12} className="text-fg-muted" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {activeConversationId ? (
          <ChatView
            conversationId={activeConversationId}
            conversations={conversations}
            setConversations={setConversations}
            initialPrompt={initialPrompt}
            clearInitialPrompt={() => setInitialPrompt(null)}
          />
        ) : view === "chat" ? (
          <EmptyChatView onNewChat={handleNewChat} onSendPrompt={handleSendFromEmpty} />
        ) : view === "memory" ? (
          <MemoryView items={memoryItems} setItems={setMemoryItems} />
        ) : view === "tasks" ? (
          <TasksView tasks={tasks} setTasks={setTasks} />
        ) : (
          <SettingsView />
        )}
      </div>
    </div>
  );
}

// ── Suggestion Chips ────────────────────────────────────────────────────────

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

// ── Empty Chat View (Instantly-style) ──────────────────────────────────────

function EmptyChatView({ onNewChat, onSendPrompt }: { onNewChat: () => void; onSendPrompt: (prompt: string) => void }) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!input.trim()) return;
    onSendPrompt(input.trim());
    setInput("");
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 max-sm:px-4">
      {/* Heading */}
      <h2 className="text-[22px] leading-7 font-semibold text-fg mb-6">
        What can I help with?
      </h2>

      {/* Composer (Clay "Ask questions and add enrichments" box) */}
      <div className="w-full max-w-2xl mb-6">
        <div data-clay-box className="rounded-lg border border-line bg-surface shadow-card transition-colors focus-within:border-accent">
          <div className="flex items-start gap-2.5 px-4 pt-3.5">
            <SparkleIcon size={16} weight="fill" className="mt-0.5 shrink-0 text-accent" />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
              }}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Ask Pulse AI or type / to see prompts..."
              className="flex-1 min-w-0 pb-2 text-[14px] leading-5 text-fg placeholder:text-fg-muted bg-transparent outline-none resize-none min-h-[64px]"
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between px-3 pb-3">
            <button className="flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-subtle hover:text-fg-secondary">
              <ClockIcon size={18} />
            </button>
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-on-inverse transition-colors hover:bg-accent-strong disabled:opacity-40 disabled:hover:bg-accent"
            >
              <ArrowUpIcon size={16} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      {/* Suggestion Chips */}
      <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
        {SUGGESTION_CHIPS.map(chip => (
          <button
            key={chip.label}
            onClick={() => onSendPrompt(chip.prompt)}
            className={SUGGESTION_CHIP}
          >
            <chip.icon size={16} className={chip.color} weight="fill" />
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Chat View ──────────────────────────────────────────────────────────────

function ChatView({
  conversationId,
  conversations,
  setConversations,
  initialPrompt,
  clearInitialPrompt,
}: {
  conversationId: string;
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  initialPrompt?: string | null;
  clearInitialPrompt?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conv = conversations.find(c => c.id === conversationId);
  const sentInitialRef = useRef(false);

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/ai/chat",
    body: { data: { pageContext: { page: "Copilot" }, conversationId } },
  }), [conversationId]);

  const { messages, sendMessage, status, setMessages, error } = useChat({ transport, id: conversationId });
  const isLoading = status === "submitted" || status === "streaming";
  const chatError = error ? describeChatError(error) : null;

  // Load existing messages
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs server data into local state; restructure tracked in PLAN.md
    setLoaded(false);
    sentInitialRef.current = false;
    getMessages(conversationId).then(result => {
      if (result.data && result.data.length > 0) {
        const mapped = result.data.map((m: Tables<"copilot_messages">) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          parts: [{ type: "text" as const, text: m.content }],
          createdAt: new Date(m.created_at),
        }));
        setMessages(mapped);
      } else {
        setMessages([]);
      }
      setLoaded(true);
    });
  }, [conversationId, setMessages]);

  // Send initial prompt if provided
  useEffect(() => {
    if (loaded && initialPrompt && !sentInitialRef.current) {
      sentInitialRef.current = true;
      sendMessage({ text: initialPrompt });
      clearInitialPrompt?.();
    }
  }, [loaded, initialPrompt]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save messages after AI responds
  const lastSavedRef = useRef(0);
  useEffect(() => {
    if (status !== "ready" || !loaded) return;
    const unsaved = messages.slice(lastSavedRef.current);
    if (unsaved.length === 0) return;

    unsaved.forEach(msg => {
      saveMessage(conversationId, msg.role as "user" | "assistant", getMessageText(msg));
    });
    lastSavedRef.current = messages.length;

    // Auto-title from first user message
    if (conv?.title === "New Chat" && messages.length >= 1) {
      const firstUserMsg = messages.find(m => m.role === "user");
      if (firstUserMsg) {
        const text = getMessageText(firstUserMsg);
        const title = text.slice(0, 60) + (text.length > 60 ? "..." : "");
        updateConversation(conversationId, { title });
        setConversations(prev =>
          prev.map(c => c.id === conversationId ? { ...c, title } : c)
        );
      }
    }
  }, [status, messages.length, loaded]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;
    await sendMessage({ text });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 min-h-0 max-sm:px-4">
        {messages.length === 0 && loaded ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h3 className="text-[18px] leading-6 font-semibold text-fg mb-1">How can I help you today?</h3>
            <p className="text-[13px] text-fg-muted mb-6">Ask about your pipeline, leads, deals, or anything CRM-related.</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
              {SUGGESTION_CHIPS.map(chip => (
                <button
                  key={chip.label}
                  onClick={() => handleSend(chip.prompt)}
                  className={SUGGESTION_CHIP}
                >
                  <chip.icon size={16} className={chip.color} weight="fill" />
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map(msg => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  data-clay-box={msg.role === "user" || undefined} className={cn(
                    "text-[14px] leading-6",
                    msg.role === "user"
                      ? "bg-accent-surface rounded-lg px-4 py-2.5 max-w-[75%] text-fg"
                      : "max-w-full text-fg prose prose-sm dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-li:my-0.5"
                  )}
                >
                  <MessageContent content={getMessageText(msg)} />
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3">
                <div className="flex gap-1.5 py-2">
                  <span className="w-2 h-2 rounded-full bg-fg-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-fg-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-fg-muted animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            {chatError && (
              <div role="alert" className="rounded-md border border-danger bg-danger-surface px-3 py-2 text-sm text-danger">
                {chatError.message}
                {chatError.needsKey && (
                  <>
                    {" "}
                    <Link href="/dashboard/settings?tab=ai" className="font-medium underline">
                      Open AI settings
                    </Link>
                  </>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  );
}

// ── Message Content (basic markdown) ─────────────────────────────────────

function MessageContent({ content }: { content: string }) {
  // Process block-level elements first (lines)
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];

  const flushList = (key: string) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={key} className="list-disc pl-5 my-2 space-y-1">
          {currentList.map((item, j) => (
            <li key={j}><InlineContent text={item} /></li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // Bullet points
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ") || trimmed.startsWith("* ")) {
      currentList.push(trimmed.slice(2));
      return;
    }

    // Numbered list
    if (/^\d+\.\s/.test(trimmed)) {
      currentList.push(trimmed.replace(/^\d+\.\s/, ""));
      return;
    }

    flushList(`list-${i}`);

    if (trimmed === "") {
      elements.push(<br key={i} />);
    } else {
      elements.push(<p key={i} className="my-1"><InlineContent text={trimmed} /></p>);
    }
  });

  flushList("list-end");

  return <div>{elements}</div>;
}

function InlineContent({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={i} className="bg-active px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Chat Input ─────────────────────────────────────────────────────────────

function ChatInput({ onSend, isLoading }: { onSend: (text: string) => void; isLoading: boolean }) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  return (
    <div className="shrink-0 px-8 pt-2 pb-6 max-sm:px-4">
      <div data-clay-box className="max-w-3xl mx-auto rounded-lg border border-line bg-surface shadow-card transition-colors focus-within:border-accent">
        <div className="flex items-start gap-2.5 px-4 pt-3.5">
          <SparkleIcon size={16} weight="fill" className="mt-0.5 shrink-0 text-accent" />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask Pulse AI or type / to see prompts..."
            className="flex-1 min-w-0 pb-1 text-[14px] leading-5 text-fg placeholder:text-fg-muted bg-transparent outline-none resize-none min-h-[40px]"
            rows={1}
            disabled={isLoading}
          />
        </div>
        <div className="flex items-center justify-end px-3 pb-3">
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-on-inverse transition-colors hover:bg-accent-strong disabled:opacity-40 disabled:hover:bg-accent"
          >
            <ArrowUpIcon size={16} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Memory View ────────────────────────────────────────────────────────────

function MemoryView({ items, setItems }: { items: MemoryItem[]; setItems: React.Dispatch<React.SetStateAction<MemoryItem[]>> }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: "business_details" as MemoryItem["type"],
    title: "",
    content: "",
  });

  // Scrape state
  const [scrapeMode, setScrapeMode] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeResults, setScrapeResults] = useState<Array<{ type: MemoryItem["type"]; title: string; content: string; selected: boolean }> | null>(null);
  const [scrapeSiteName, setScrapeSiteName] = useState("");
  const [savingScrape, setSavingScrape] = useState(false);

  const memoryTypes = [
    { value: "business_details", label: "Business Details", desc: "Company info, industry, size" },
    { value: "product_info", label: "Product / Service", desc: "What you sell, pricing, features" },
    { value: "target_audience", label: "Target Audience", desc: "ICP, personas, verticals" },
    { value: "brand_voice", label: "Brand Voice", desc: "Tone, messaging guidelines" },
    { value: "custom", label: "Custom", desc: "Any other business context" },
  ];

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Title and content are required");
      return;
    }

    if (editingId) {
      const result = await updateMemoryItem(editingId, formData);
      if (result.success) {
        setItems(prev => prev.map(m => m.id === editingId ? { ...m, ...formData } : m));
        toast.success("Memory updated");
      }
    } else {
      const result = await createMemoryItem({ ...formData, source: "manual" });
      if (result.data) {
        setItems(prev => [result.data!, ...prev]);
        toast.success("Memory added");
      }
    }
    setShowForm(false);
    setEditingId(null);
    setFormData({ type: "business_details", title: "", content: "" });
  };

  const handleDelete = async (id: string) => {
    await deleteMemoryItem(id);
    setItems(prev => prev.filter(m => m.id !== id));
    toast.success("Memory deleted");
  };

  const handleEdit = (item: MemoryItem) => {
    setFormData({ type: item.type, title: item.title, content: item.content });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) {
      toast.error("Please enter a website URL");
      return;
    }
    setScraping(true);
    const result = await scrapeWebsiteForMemory(scrapeUrl.trim());
    setScraping(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    if (result.data) {
      setScrapeResults(result.data.map(item => ({ ...item, selected: true })));
      setScrapeSiteName(result.siteName || "website");
    }
  };

  const handleSaveScrapeResults = async () => {
    const selected = scrapeResults?.filter(r => r.selected) || [];
    if (selected.length === 0) {
      toast.error("Select at least one item to save");
      return;
    }

    setSavingScrape(true);
    let saved = 0;
    for (const item of selected) {
      const result = await createMemoryItem({
        type: item.type,
        title: item.title,
        content: item.content,
        source: "website",
        source_url: scrapeUrl.trim(),
      });
      if (result.data) {
        setItems(prev => [result.data!, ...prev]);
        saved++;
      }
    }
    setSavingScrape(false);

    if (saved > 0) {
      toast.success(`Saved ${saved} item${saved > 1 ? "s" : ""} from ${scrapeSiteName}`);
      setScrapeMode(false);
      setScrapeUrl("");
      setScrapeResults(null);
      setScrapeSiteName("");
    }
  };

  const exitScrapeMode = () => {
    setScrapeMode(false);
    setScrapeUrl("");
    setScrapeResults(null);
    setScrapeSiteName("");
    setScraping(false);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Page>
        <PageHeader
          icon={<BrainIcon size={18} />}
          title="Memory"
          description="Pulse Copilot uses your business details to provide context-aware responses."
        />

        {showForm ? (
          /* Memory Form */
          <Section title={editingId ? "Edit Memory" : "Add Memory"}>
            <div className="max-w-[560px] space-y-4">
              <div>
                <label className={LABEL}>Type</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as MemoryItem["type"] }))}
                  className={cn(FIELD, "h-8")}
                >
                  {memoryTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={LABEL}>Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Company Overview"
                  className={cn(FIELD, "h-8")}
                />
              </div>

              <div>
                <label className={LABEL}>Content</label>
                <textarea
                  value={formData.content}
                  onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Describe your business, products, target audience, etc..."
                  rows={6}
                  className={cn(FIELD, "py-2 resize-none")}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button onClick={handleSave} className={BTN_PRIMARY}>
                  {editingId ? "Update" : "Save"}
                </button>
                <button
                  onClick={() => { setShowForm(false); setEditingId(null); setFormData({ type: "business_details", title: "", content: "" }); }}
                  className={BTN_OUTLINE}
                >
                  Cancel
                </button>
              </div>
            </div>
          </Section>
        ) : scrapeMode ? (
          /* Scrape Flow */
          scrapeResults === null ? (
            /* Phase A: URL Input */
            <Section
              title="Scan a website"
              icon={<SparkleIcon size={18} />}
              description="Enter your website URL and AI will automatically extract business details, products, audience, and brand voice."
            >
              <div className="flex max-w-[560px] gap-2">
                <input
                  type="url"
                  value={scrapeUrl}
                  onChange={e => setScrapeUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !scraping && handleScrape()}
                  placeholder="https://yourcompany.com"
                  disabled={scraping}
                  className={cn(FIELD, "h-8 flex-1 disabled:opacity-50")}
                />
                <button
                  onClick={handleScrape}
                  disabled={scraping || !scrapeUrl.trim()}
                  className={BTN_PRIMARY}
                >
                  {scraping ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    "Scan"
                  )}
                </button>
                <button
                  onClick={exitScrapeMode}
                  disabled={scraping}
                  className={BTN_GHOST}
                >
                  Cancel
                </button>
              </div>
            </Section>
          ) : (
            /* Phase B: Results Review */
            <Section
              title={<>Found {scrapeResults.length} item{scrapeResults.length > 1 ? "s" : ""} from {scrapeSiteName}</>}
              icon={<SparkleIcon size={16} />}
              actions={<span className="text-[13px] text-fg-muted">{scrapeResults.filter(r => r.selected).length} selected</span>}
            >
              <div className="max-h-[400px] overflow-y-auto border-t border-divider">
                {scrapeResults.map((result, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "py-4 border-b border-divider transition-opacity",
                      !result.selected && "opacity-60"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => setScrapeResults(prev => prev!.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r))}
                        className={cn(
                          "mt-0.5 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
                          result.selected
                            ? "bg-accent-surface border-accent text-accent-on-surface"
                            : "border-line"
                        )}
                      >
                        {result.selected && <CheckIcon size={12} />}
                      </button>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] px-2 py-0.5 rounded-full bg-muted text-fg-secondary font-medium">
                            {memoryTypes.find(t => t.value === result.type)?.label || result.type}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={result.title}
                          onChange={e => setScrapeResults(prev => prev!.map((r, i) => i === idx ? { ...r, title: e.target.value } : r))}
                          className="w-full text-[14px] font-medium text-fg bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
                        />
                        <textarea
                          value={result.content}
                          onChange={e => setScrapeResults(prev => prev!.map((r, i) => i === idx ? { ...r, content: e.target.value } : r))}
                          rows={2}
                          className="w-full text-[13px] text-fg-secondary bg-transparent border-0 p-0 focus:outline-none focus:ring-0 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-4">
                <button
                  onClick={handleSaveScrapeResults}
                  disabled={savingScrape || scrapeResults.filter(r => r.selected).length === 0}
                  className={BTN_PRIMARY}
                >
                  {savingScrape ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    `Save ${scrapeResults.filter(r => r.selected).length} selected`
                  )}
                </button>
                <button
                  onClick={() => { setScrapeResults(null); setScrapeUrl(""); }}
                  className={BTN_OUTLINE}
                >
                  Back
                </button>
                <button
                  onClick={exitScrapeMode}
                  className={BTN_GHOST}
                >
                  Cancel
                </button>
              </div>
            </Section>
          )
        ) : (
          <>
            {/* Quick Add Tiles */}
            <Section>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => {
                    setFormData({ type: "business_details", title: "Business Overview", content: "" });
                    setShowForm(true);
                  }}
                  data-clay-box className="flex w-[230px] items-start gap-3 rounded-lg bg-subtle p-4 text-left shadow-card transition-colors hover:bg-muted max-sm:w-full"
                >
                  <GlobeIcon size={18} className="mt-0.5 shrink-0 text-accent" />
                  <div>
                    <p className="text-[14px] font-semibold text-fg">Add business details</p>
                    <p className="text-[13px] text-fg-muted mt-0.5">Company info, products</p>
                  </div>
                </button>
                <button
                  onClick={() => setScrapeMode(true)}
                  data-clay-box className="flex w-[230px] items-start gap-3 rounded-lg bg-subtle p-4 text-left shadow-card transition-colors hover:bg-muted max-sm:w-full"
                >
                  <SparkleIcon size={18} className="mt-0.5 shrink-0 text-accent" />
                  <div>
                    <p className="text-[14px] font-semibold text-fg">Scan a website</p>
                    <p className="text-[13px] text-fg-muted mt-0.5">Auto-extract with AI</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setFormData({ type: "custom", title: "", content: "" });
                    setShowForm(true);
                  }}
                  data-clay-box className="flex w-[230px] items-start gap-3 rounded-lg bg-subtle p-4 text-left shadow-card transition-colors hover:bg-muted max-sm:w-full"
                >
                  <PencilSimpleIcon size={18} className="mt-0.5 shrink-0 text-accent" />
                  <div>
                    <p className="text-[14px] font-semibold text-fg">Edit manually</p>
                    <p className="text-[13px] text-fg-muted mt-0.5">Custom business context</p>
                  </div>
                </button>
              </div>
            </Section>

            {/* Existing Memory Items */}
            {items.length > 0 && (
              <Section title="Saved Context">
                <div className="border-t border-divider">
                  {items.map(item => (
                    <div key={item.id} className="group flex items-start justify-between py-3 border-b border-divider">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[12px] px-2 py-0.5 rounded-full bg-muted text-fg-secondary font-medium">
                            {memoryTypes.find(t => t.value === item.type)?.label || item.type}
                          </span>
                          {item.source === "website" && (
                            <span className="text-[12px] px-2 py-0.5 rounded-full bg-accent-surface text-accent-on-surface">Website</span>
                          )}
                          {!item.is_active && (
                            <span className="text-[12px] px-2 py-0.5 rounded-full bg-warning-surface text-warning">Disabled</span>
                          )}
                        </div>
                        <h4 className="text-[14px] font-medium text-fg">{item.title}</h4>
                        <p className="text-[13px] text-fg-muted mt-1 line-clamp-2">{item.content}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                        <button onClick={() => handleEdit(item)} className="p-1.5 rounded hover:bg-subtle transition-colors">
                          <PencilSimpleIcon size={14} className="text-fg-muted" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-danger-surface transition-colors">
                          <TrashIcon size={14} className="text-danger" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </Page>
    </div>
  );
}

// ── Tasks View ─────────────────────────────────────────────────────────────

function TasksView({ tasks, setTasks }: { tasks: CopilotTask[]; setTasks: React.Dispatch<React.SetStateAction<CopilotTask[]>> }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    prompt: "",
    schedule: "daily" as CopilotTask["schedule"],
  });

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.prompt.trim()) {
      toast.error("Title and prompt are required");
      return;
    }

    if (editingId) {
      const result = await updateCopilotTask(editingId, formData);
      if (result.success) {
        setTasks(prev => prev.map(t => t.id === editingId ? { ...t, ...formData } : t));
        toast.success("Task updated");
      }
    } else {
      const result = await createCopilotTask(formData);
      if (result.data) {
        setTasks(prev => [result.data!, ...prev]);
        toast.success("Task created");
      }
    }
    setShowForm(false);
    setEditingId(null);
    setFormData({ title: "", prompt: "", schedule: "daily" });
  };

  const handleToggle = async (task: CopilotTask) => {
    const result = await updateCopilotTask(task.id, { is_active: !task.is_active });
    if (result.success) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_active: !t.is_active } : t));
    }
  };

  const handleDelete = async (id: string) => {
    await deleteCopilotTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    toast.success("Task deleted");
  };

  const scheduleLabels: Record<string, string> = {
    daily: "Every day",
    weekly: "Every week",
    monthly: "Every month",
    custom: "Custom schedule",
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Page>
        <PageHeader
          icon={<ClockIcon size={18} />}
          title="Tasks"
          description="Manage recurring prompts that Copilot can execute on a schedule."
        >
          {!showForm && (
            <button onClick={() => setShowForm(true)} className={BTN_PRIMARY}>
              <PlusIcon size={16} weight="bold" />
              Create new task
            </button>
          )}
        </PageHeader>

        {!showForm ? (
          tasks.length === 0 ? (
            <div className="border-t border-divider">
              <EmptyState
                icon={<ClockIcon size={24} />}
                title="No tasks yet"
                description="Create recurring prompts to automate your workflow."
              />
            </div>
          ) : (
            <div className="border-t border-divider">
              {tasks.map(task => (
                <div key={task.id} className="group flex items-start justify-between gap-3 px-8 py-3 border-b border-divider transition-colors hover:bg-subtle max-sm:px-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-[14px] font-medium text-fg">{task.title}</h4>
                      <span className={cn(
                        "text-[12px] px-2 py-0.5 rounded-full font-medium",
                        task.is_active
                          ? "bg-success-surface text-success"
                          : "bg-muted text-fg-secondary"
                      )}>
                        {task.is_active ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="text-[13px] text-fg-secondary line-clamp-1 mb-1">{task.prompt}</p>
                    <div className="flex items-center gap-3 text-[12px] text-fg-muted">
                      <span className="flex items-center gap-1">
                        <ClockIcon size={12} />
                        {scheduleLabels[task.schedule]}
                      </span>
                      {task.run_count > 0 && <span>Ran {task.run_count} times</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                    <button
                      onClick={() => handleToggle(task)}
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                      title={task.is_active ? "Pause" : "Activate"}
                    >
                      {task.is_active ? (
                        <XIcon size={14} className="text-fg-muted" />
                      ) : (
                        <CheckIcon size={14} className="text-success" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setFormData({ title: task.title, prompt: task.prompt, schedule: task.schedule });
                        setEditingId(task.id);
                        setShowForm(true);
                      }}
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                    >
                      <PencilSimpleIcon size={14} className="text-fg-muted" />
                    </button>
                    <button onClick={() => handleDelete(task.id)} className="p-1.5 rounded hover:bg-danger-surface transition-colors">
                      <TrashIcon size={14} className="text-danger" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Task Form */
          <Section title={editingId ? "Edit Task" : "Create Task"}>
            <div className="max-w-[560px] space-y-4">
              <div>
                <label className={LABEL}>Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Daily Pipeline Summary"
                  className={cn(FIELD, "h-8")}
                />
              </div>

              <div>
                <label className={LABEL}>Prompt</label>
                <textarea
                  value={formData.prompt}
                  onChange={e => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                  placeholder="What should Copilot do? e.g. Summarize my pipeline and highlight deals at risk..."
                  rows={4}
                  className={cn(FIELD, "py-2 resize-none")}
                />
              </div>

              <div>
                <label className={LABEL}>Schedule</label>
                <select
                  value={formData.schedule}
                  onChange={e => setFormData(prev => ({ ...prev, schedule: e.target.value as CopilotTask["schedule"] }))}
                  className={cn(FIELD, "h-8")}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button onClick={handleSave} className={BTN_PRIMARY}>
                  {editingId ? "Update" : "Create"}
                </button>
                <button
                  onClick={() => { setShowForm(false); setEditingId(null); setFormData({ title: "", prompt: "", schedule: "daily" }); }}
                  className={BTN_OUTLINE}
                >
                  Cancel
                </button>
              </div>
            </div>
          </Section>
        )}
      </Page>
    </div>
  );
}

// ── Settings View ──────────────────────────────────────────────────────────

function SettingsView() {
  return (
    <div className="flex-1 overflow-y-auto">
      <Page>
        <PageHeader
          icon={<GearIcon size={18} />}
          title="Copilot Settings"
          description="Configure your Pulse Copilot settings."
        />

        <p className="px-8 pb-4 text-[13px] text-fg-secondary max-sm:px-4">These settings are coming soon.</p>

        <fieldset disabled className="min-w-0 opacity-60">
          {/* Analytics Toggle */}
          <div className="flex items-center justify-between gap-4 px-8 py-5 border-t border-divider max-sm:px-4">
            <div>
              <h3 className="text-[14px] font-semibold text-fg">Analytics</h3>
              <p className="text-[13px] text-fg-muted mt-0.5">
                Enable analytics tracking for Copilot interactions and performance metrics.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-fg-secondary px-3 py-1.5 rounded text-xs font-medium transition-colors">
                Disable
              </button>
              <button className="bg-success text-on-inverse px-3 py-1.5 rounded text-xs font-medium transition-colors">
                Enable
              </button>
            </div>
          </div>

          {/* Model Selection */}
          <div className="flex items-center justify-between gap-4 px-8 py-5 border-t border-divider max-sm:px-4">
            <div>
              <h3 className="text-[14px] font-semibold text-fg">AI Model</h3>
              <p className="text-[13px] text-fg-muted mt-0.5">
                Choose the AI model for Copilot responses.
              </p>
            </div>
            <select className="pl-3 pr-8 py-1.5 rounded border border-line bg-surface text-xs font-medium text-fg appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%236b7280%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1.25rem_1.25rem]">
              <option>Claude Sonnet 4.6</option>
              <option>Claude Haiku 4.5</option>
            </select>
          </div>

          {/* Chat History */}
          <div className="flex items-center justify-between gap-4 px-8 py-5 border-y border-divider max-sm:px-4">
            <div>
              <h3 className="text-[14px] font-semibold text-fg">Chat History</h3>
              <p className="text-[13px] text-fg-muted mt-0.5">
                Automatically save chat conversations for future reference.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-fg-secondary px-3 py-1.5 rounded text-xs font-medium transition-colors">
                Disable
              </button>
              <button className="bg-success text-on-inverse px-3 py-1.5 rounded text-xs font-medium transition-colors">
                Enable
              </button>
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end px-8 pt-4 max-sm:px-4">
            <button className={BTN_PRIMARY}>
              Save
            </button>
          </div>
        </fieldset>
      </Page>
    </div>
  );
}
