"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
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
} from "@/components/ui";
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
    <div className="flex h-[calc(100vh-64px)] bg-white dark:bg-neutral-950">
      {/* Left Sidebar */}
      <div className="w-64 border-r border-neutral-200 dark:border-neutral-800 flex flex-col bg-neutral-50 dark:bg-neutral-900/50">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-neutral-900 dark:bg-white flex items-center justify-center">
              <SparkleIcon size={14} className="text-white dark:text-neutral-900" weight="fill" />
            </div>
            <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Pulse Copilot</h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-0.5">
          {navItems.map(item => (
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
                "flex items-center gap-2.5 w-full px-3 py-2 rounded text-sm font-medium transition-colors",
                view === item.id && !activeConversationId
                  ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm border border-neutral-200 dark:border-neutral-700"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3 mt-1">
            {conversations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-neutral-400 dark:text-neutral-500">No chat history yet</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">Start a new chat to begin</p>
              </div>
            ) : (
              <div className="space-y-0.5">
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
                      "flex items-center justify-between w-full px-3 py-2 rounded text-sm transition-colors group cursor-pointer",
                      activeConversationId === conv.id
                        ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm border border-neutral-200 dark:border-neutral-700"
                        : "text-neutral-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800"
                    )}
                  >
                    <span className="truncate text-left flex-1">{conv.title}</span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteConversation(conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                    >
                      <TrashIcon size={12} className="text-neutral-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
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
  { label: "Find Ideal Prospects", icon: CrosshairIcon, color: "text-amber-500", prompt: "Help me find ideal prospects that match my ICP. Analyze my current leads and suggest the best profiles to target." },
  { label: "Generate a Full Campaign", icon: LightningIcon, color: "text-violet-500", prompt: "Generate a full outreach campaign for my top leads. Include email sequences, follow-up timing, and personalization suggestions." },
  { label: "Write a Sequence", icon: EnvelopeIcon, color: "text-purple-500", prompt: "Help me write an email sequence for lead outreach. I need a multi-step drip campaign." },
  { label: "Campaign Ideas", icon: StarIcon, color: "text-blue-500", prompt: "Give me creative campaign ideas based on my current pipeline and leads. What strategies would work best?" },
  { label: "Weekly Analytics", icon: ChartBarIcon, color: "text-emerald-500", prompt: "Give me a weekly analytics summary. Include pipeline changes, lead activity, deals won/lost, and key metrics." },
  { label: "Best Performing Campaigns", icon: ChartBarIcon, color: "text-teal-500", prompt: "Analyze my campaigns and tell me which ones are performing best. Include open rates, reply rates, and conversion metrics." },
  { label: "Get Advice", icon: ChatCircleIcon, color: "text-red-400", prompt: "I need advice on my sales strategy. Review my pipeline and suggest improvements." },
  { label: "Audit My Workspace", icon: ShieldIcon, color: "text-green-500", prompt: "Audit my CRM workspace. Check for stale leads, stuck deals, missing follow-ups, and data quality issues." },
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
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      {/* Heading */}
      <h2 className="text-[28px] leading-[36px] tracking-[-0.56px] font-serif text-neutral-950 dark:text-neutral-50 mb-8">
        What can I help with?
      </h2>

      {/* Large Input Box */}
      <div className="w-full max-w-2xl mb-8">
        <div className="border border-neutral-200 dark:border-neutral-700 rounded-2xl bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
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
            className="w-full px-5 pt-4 pb-2 text-base text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 bg-transparent outline-none resize-none min-h-[80px]"
            rows={2}
          />
          <div className="flex items-center justify-between px-4 pb-3">
            <button className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <ClockIcon size={18} />
            </button>
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-sm hover:from-indigo-600 hover:to-violet-600 disabled:opacity-30 disabled:hover:from-indigo-500 disabled:hover:to-violet-500 transition-all"
            >
              <ArrowUpIcon size={18} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      {/* Suggestion Chips */}
      <div className="flex flex-wrap justify-center gap-2.5 max-w-2xl">
        {SUGGESTION_CHIPS.map(chip => (
          <button
            key={chip.label}
            onClick={() => onSendPrompt(chip.prompt)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all shadow-sm"
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

  const { messages, sendMessage, status, setMessages } = useChat({ transport, id: conversationId });
  const isLoading = status === "submitted" || status === "streaming";

  // Load existing messages
  useEffect(() => {
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
    <div className="flex-1 flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 && loaded ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">How can I help you today?</h3>
            <p className="text-sm text-neutral-400 dark:text-neutral-500">Ask about your pipeline, leads, deals, or anything CRM-related.</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map(msg => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-neutral-100 dark:bg-neutral-800 rounded-2xl px-4 py-3 max-w-[75%] text-neutral-900 dark:text-neutral-100"
                      : "max-w-full text-neutral-800 dark:text-neutral-200 prose prose-sm dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-li:my-0.5"
                  )}
                >
                  <MessageContent content={getMessageText(msg)} />
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3">
                <div className="flex gap-1.5 py-2">
                  <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
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
          return <code key={i} className="bg-neutral-200 dark:bg-neutral-700 px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
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
    <div className="px-6 py-4">
      <div className="max-w-3xl mx-auto border border-neutral-200 dark:border-neutral-700 rounded-2xl bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
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
          className="w-full px-5 pt-4 pb-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 bg-transparent outline-none resize-none min-h-[48px]"
          rows={1}
          disabled={isLoading}
        />
        <div className="flex items-center justify-end px-4 pb-3">
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-sm hover:from-indigo-600 hover:to-violet-600 disabled:opacity-30 disabled:hover:from-indigo-500 disabled:hover:to-violet-500 transition-all"
          >
            <ArrowUpIcon size={18} weight="bold" />
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

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Memory</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Pulse Copilot uses your business details to provide context-aware responses.
          </p>
        </div>

        {!showForm ? (
          <>
            {/* Quick Add Cards */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button
                onClick={() => {
                  setFormData({ type: "business_details", title: "Business Overview", content: "" });
                  setShowForm(true);
                }}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-sm transition-all bg-white dark:bg-neutral-800/50"
              >
                <GlobeIcon size={28} className="text-neutral-400" />
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Add business details</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Company info, products, audience</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setFormData({ type: "custom", title: "", content: "" });
                  setShowForm(true);
                }}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-sm transition-all bg-white dark:bg-neutral-800/50"
              >
                <PencilSimpleIcon size={28} className="text-neutral-400" />
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Edit manually</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Add any custom business context</p>
                </div>
              </button>
            </div>

            {/* Existing Memory Items */}
            {items.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-3">Saved Context</h3>
                {items.map(item => (
                  <div key={item.id} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 font-medium">
                            {memoryTypes.find(t => t.value === item.type)?.label || item.type}
                          </span>
                          {!item.is_active && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Disabled</span>
                          )}
                        </div>
                        <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{item.title}</h4>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">{item.content}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                        <button onClick={() => handleEdit(item)} className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                          <PencilSimpleIcon size={14} className="text-neutral-400" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                          <TrashIcon size={14} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Memory Form */
          <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              {editingId ? "Edit Memory" : "Add Memory"}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">Type</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as MemoryItem["type"] }))}
                  className="w-full px-3 py-2 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100"
                >
                  {memoryTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Company Overview"
                  className="w-full px-3 py-2 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">Content</label>
                <textarea
                  value={formData.content}
                  onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Describe your business, products, target audience, etc..."
                  rows={6}
                  className="w-full px-3 py-2 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button onClick={handleSave} className="px-4 py-2 rounded bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors">
                  {editingId ? "Update" : "Save"}
                </button>
                <button
                  onClick={() => { setShowForm(false); setEditingId(null); setFormData({ type: "business_details", title: "", content: "" }); }}
                  className="px-4 py-2 rounded border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
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
      <div className="max-w-2xl mx-auto p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Tasks</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Manage recurring prompts that Copilot can execute on a schedule.
          </p>
        </div>

        {!showForm ? (
          <>
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors mb-6"
            >
              <PlusIcon size={16} weight="bold" />
              Create new task
            </button>

            {tasks.length === 0 ? (
              <div className="text-center py-12">
                <ClockIcon size={40} className="text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                <p className="text-sm text-neutral-500 dark:text-neutral-400">No tasks yet</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Create recurring prompts to automate your workflow.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => (
                  <div key={task.id} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{task.title}</h4>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            task.is_active
                              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                              : "bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                          )}>
                            {task.is_active ? "Active" : "Paused"}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mb-1">{task.prompt}</p>
                        <div className="flex items-center gap-3 text-xs text-neutral-400">
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
                          className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                          title={task.is_active ? "Pause" : "Activate"}
                        >
                          {task.is_active ? (
                            <XIcon size={14} className="text-neutral-400" />
                          ) : (
                            <CheckIcon size={14} className="text-emerald-500" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setFormData({ title: task.title, prompt: task.prompt, schedule: task.schedule });
                            setEditingId(task.id);
                            setShowForm(true);
                          }}
                          className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                        >
                          <PencilSimpleIcon size={14} className="text-neutral-400" />
                        </button>
                        <button onClick={() => handleDelete(task.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                          <TrashIcon size={14} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Task Form */
          <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              {editingId ? "Edit Task" : "Create Task"}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Daily Pipeline Summary"
                  className="w-full px-3 py-2 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">Prompt</label>
                <textarea
                  value={formData.prompt}
                  onChange={e => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                  placeholder="What should Copilot do? e.g. Summarize my pipeline and highlight deals at risk..."
                  rows={4}
                  className="w-full px-3 py-2 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">Schedule</label>
                <select
                  value={formData.schedule}
                  onChange={e => setFormData(prev => ({ ...prev, schedule: e.target.value as CopilotTask["schedule"] }))}
                  className="w-full px-3 py-2 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button onClick={handleSave} className="px-4 py-2 rounded bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors">
                  {editingId ? "Update" : "Create"}
                </button>
                <button
                  onClick={() => { setShowForm(false); setEditingId(null); setFormData({ title: "", prompt: "", schedule: "daily" }); }}
                  className="px-4 py-2 rounded border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Settings View ──────────────────────────────────────────────────────────

function SettingsView() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Copilot Settings</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Configure your Pulse Copilot settings.
          </p>
        </div>

        <div className="space-y-4">
          {/* Analytics Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50">
            <div>
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Analytics</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Enable analytics tracking for Copilot interactions and performance metrics.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAnalyticsEnabled(false)}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  !analyticsEnabled
                    ? "bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                    : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                )}
              >
                Disable
              </button>
              <button
                onClick={() => setAnalyticsEnabled(true)}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  analyticsEnabled
                    ? "bg-emerald-500 text-white"
                    : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                )}
              >
                Enable
              </button>
            </div>
          </div>

          {/* Model Selection */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50">
            <div>
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">AI Model</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Choose the AI model for Copilot responses.
              </p>
            </div>
            <select className="pl-3 pr-8 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-medium text-neutral-900 dark:text-neutral-100 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%236b7280%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1.25rem_1.25rem]">
              <option>Claude Sonnet 4</option>
              <option>Claude Haiku 3.5</option>
            </select>
          </div>

          {/* Chat History */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50">
            <div>
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Chat History</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Automatically save chat conversations for future reference.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-3 py-1.5 rounded text-xs font-medium transition-colors">
                Disable
              </button>
              <button className="bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors">
                Enable
              </button>
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end pt-4">
            <button
              onClick={() => toast.success("Settings saved")}
              className="px-4 py-2 rounded bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
