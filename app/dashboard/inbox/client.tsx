"use client";

import { useState, useEffect, useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  Button,
  Input,
  Toast,
  Badge,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  StarIcon,
  CircleNotchIcon,
  XIcon,
  ArrowLeftIcon,
  PaperPlaneTiltIcon,
  CheckIcon,
  ArrowPathIcon,
  WarningIcon,
  EyeIcon,
} from "@/components/ui";
import {
  getEmailThreads,
  getThreadMessages,
  markThreadRead,
  toggleThreadStar,
  archiveThread,
  getActiveEmailAccounts,
  getInboxStats,
} from "@/lib/actions/email-inbox";
import { composeAndSendEmail, sendReply } from "@/lib/actions/email-send";

// ── Types ──────────────────────────────────────────────────────────────────

interface EmailThread {
  id: string;
  subject: string;
  snippet: string | null;
  last_message_at: string;
  message_count: number;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  email_account_id: string;
  lead_id: string | null;
  contact_id: string | null;
  email_accounts: {
    id: string;
    email_address: string;
    provider: string;
    display_name: string | null;
  };
  leads: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    company: string | null;
  } | null;
  contacts: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

interface EmailMessage {
  id: string;
  direction: "inbound" | "outbound";
  from_address: string;
  to_addresses: string[];
  subject: string;
  body_html: string;
  body_text: string | null;
  status: string;
  open_count: number;
  click_count: number;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
}

interface EmailAccount {
  id: string;
  email_address: string;
  display_name: string | null;
  provider: string;
  is_default: boolean;
}

// ── Main Inbox Component ───────────────────────────────────────────────────

export function InboxClient() {
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [stats, setStats] = useState({ unread: 0, total: 0 });

  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [search, setSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterView, setFilterView] = useState<"all" | "unread" | "starred">("all");

  // Compose
  const [showCompose, setShowCompose] = useState(false);
  const [showReply, setShowReply] = useState(false);

  // Toast
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<"success" | "error">("success");

  const toast = (msg: string, v: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastVariant(v);
    setShowToast(true);
  };

  // ── Data Loading ───────────────────────────────────────────────────────

  const fetchThreads = async () => {
    const result = await getEmailThreads({
      accountId: filterAccount || undefined,
      isRead: filterView === "unread" ? false : undefined,
      isStarred: filterView === "starred" ? true : undefined,
      search: search || undefined,
    });
    if (result.data) setThreads(result.data as unknown as EmailThread[]);
    setLoading(false);
  };

  const fetchStats = async () => {
    const s = await getInboxStats();
    setStats(s);
  };

  useEffect(() => {
    Promise.all([fetchThreads(), fetchStats()]);
    getActiveEmailAccounts().then((r) => {
      if (r.data) setAccounts(r.data as EmailAccount[]);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchThreads();
  }, [search, filterAccount, filterView]);

  const openThread = async (thread: EmailThread) => {
    setSelectedThread(thread);
    setLoadingMessages(true);
    setShowReply(false);
    const result = await getThreadMessages(thread.id);
    if (result.data) setMessages(result.data as EmailMessage[]);
    setLoadingMessages(false);

    // Mark as read
    if (!thread.is_read) {
      await markThreadRead(thread.id, true);
      setThreads((prev) =>
        prev.map((t) => (t.id === thread.id ? { ...t, is_read: true } : t)),
      );
      fetchStats();
    }
  };

  const handleStar = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await toggleThreadStar(threadId);
    if (result.success) {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId ? { ...t, is_starred: result.isStarred ?? !t.is_starred } : t,
        ),
      );
    }
  };

  const handleArchive = async (threadId: string) => {
    await archiveThread(threadId);
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    if (selectedThread?.id === threadId) {
      setSelectedThread(null);
      setMessages([]);
    }
    toast("Thread archived");
    fetchStats();
  };

  // ── Helpers ────────────────────────────────────────────────────────────

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (days === 1) return "Yesterday";
    if (days < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getThreadName = (thread: EmailThread) => {
    if (thread.leads) {
      return `${thread.leads.first_name || ""} ${thread.leads.last_name || ""}`.trim() || thread.leads.email;
    }
    if (thread.contacts) {
      return `${thread.contacts.first_name || ""} ${thread.contacts.last_name || ""}`.trim() || thread.contacts.email;
    }
    return thread.subject || "No subject";
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "sent": return <Badge variant="blue">Sent</Badge>;
      case "delivered": return <Badge variant="green">Delivered</Badge>;
      case "opened": return <Badge variant="emerald">Opened</Badge>;
      case "clicked": return <Badge variant="violet">Clicked</Badge>;
      case "bounced": return <Badge variant="red">Bounced</Badge>;
      case "failed": return <Badge variant="red">Failed</Badge>;
      default: return null;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full bg-white dark:bg-neutral-950">
      {/* Thread List (left panel) */}
      <div
        className={cn(
          "w-96 max-lg:w-80 shrink-0 border-r border-neutral-200 dark:border-neutral-800 flex flex-col",
          selectedThread ? "max-md:hidden" : "max-md:w-full",
        )}
      >
        {/* Inbox Header */}
        <div className="px-4 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
              Inbox
              {stats.unread > 0 && (
                <span className="ml-2 text-sm font-normal text-neutral-500">
                  ({stats.unread} unread)
                </span>
              )}
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setLoading(true); fetchThreads(); fetchStats(); }}
                className="p-1.5 rounded text-neutral-500 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <ArrowPathIcon size={16} />
              </button>
              <Button size="sm" onClick={() => setShowCompose(true)}>
                <PaperPlaneTiltIcon size={14} className="mr-1.5" />
                Compose
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <MagnifyingGlassIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search emails..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-500/30"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1">
            {(["all", "unread", "starred"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilterView(v)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                  filterView === v
                    ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                    : "text-neutral-500 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                )}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-neutral-400">
              <CircleNotchIcon size={24} className="animate-spin" />
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <EnvelopeIcon size={40} className="text-neutral-300 dark:text-neutral-600 mb-3" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
                {filterView === "unread" ? "No unread emails" :
                  filterView === "starred" ? "No starred emails" :
                    search ? "No emails match your search" :
                      "Your inbox is empty"}
              </p>
            </div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => openThread(thread)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors",
                  selectedThread?.id === thread.id && "bg-neutral-100 dark:bg-neutral-800/50",
                  !thread.is_read && "bg-blue-50/50 dark:bg-blue-950/10",
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Unread dot */}
                  <div className="pt-1.5 w-2 shrink-0">
                    {!thread.is_read && (
                      <span className="block w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={cn(
                        "text-sm truncate",
                        !thread.is_read ? "font-semibold text-neutral-950 dark:text-neutral-50" : "font-medium text-neutral-700 dark:text-neutral-300",
                      )}>
                        {getThreadName(thread)}
                      </span>
                      <span className="text-xs text-neutral-400 shrink-0">
                        {formatDate(thread.last_message_at)}
                      </span>
                    </div>
                    <p className={cn(
                      "text-sm truncate",
                      !thread.is_read ? "text-neutral-700 dark:text-neutral-300" : "text-neutral-500 dark:text-neutral-400",
                    )}>
                      {thread.subject || "No subject"}
                    </p>
                    {thread.snippet && (
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
                        {thread.snippet}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-neutral-400 uppercase">
                        {thread.email_accounts.provider}
                      </span>
                      {thread.message_count > 1 && (
                        <span className="text-[10px] text-neutral-400">
                          {thread.message_count} messages
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Star button */}
                  <button
                    onClick={(e) => handleStar(thread.id, e)}
                    className="p-1 shrink-0"
                  >
                    <StarIcon
                      size={14}
                      weight={thread.is_starred ? "fill" : "regular"}
                      className={cn(
                        thread.is_starred ? "text-amber-500" : "text-neutral-300 dark:text-neutral-600 hover:text-amber-400",
                      )}
                    />
                  </button>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message View (right panel) */}
      <div
        className={cn(
          "flex-1 min-w-0 flex flex-col",
          !selectedThread && "max-md:hidden",
        )}
      >
        {selectedThread ? (
          <>
            {/* Thread header */}
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
              <button
                onClick={() => { setSelectedThread(null); setMessages([]); }}
                className="md:hidden p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <ArrowLeftIcon size={18} />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50 truncate">
                  {selectedThread.subject || "No subject"}
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {getThreadName(selectedThread)} &middot; {selectedThread.message_count} message{selectedThread.message_count !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleArchive(selectedThread.id)}
                  className="text-xs px-3 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  Archive
                </button>
                <Button size="sm" onClick={() => setShowReply(!showReply)}>
                  Reply
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <CircleNotchIcon size={24} className="animate-spin text-neutral-400" />
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "rounded border p-4",
                      msg.direction === "outbound"
                        ? "border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50"
                        : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900",
                    )}
                  >
                    {/* Message header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold",
                          msg.direction === "outbound"
                            ? "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
                            : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
                        )}>
                          {(msg.from_address || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                            {msg.from_address || "Unknown"}
                          </p>
                          <p className="text-xs text-neutral-400">
                            To: {msg.to_addresses.join(", ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(msg.status)}
                        {msg.open_count > 0 && (
                          <span className="text-xs text-neutral-400 flex items-center gap-1">
                            <EyeIcon size={12} /> {msg.open_count}
                          </span>
                        )}
                        <span className="text-xs text-neutral-400">
                          {msg.sent_at || msg.received_at
                            ? formatDate(msg.sent_at || msg.received_at || msg.created_at)
                            : formatDate(msg.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Message body */}
                    <div
                      className="text-sm text-neutral-700 dark:text-neutral-300 prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: msg.body_html || msg.body_text || "" }}
                    />
                  </div>
                ))
              )}
            </div>

            {/* Reply box */}
            {showReply && (
              <ReplyBox
                threadId={selectedThread.id}
                accountId={selectedThread.email_account_id}
                accounts={accounts}
                onSent={() => {
                  toast("Reply sent");
                  setShowReply(false);
                  openThread(selectedThread);
                }}
                onCancel={() => setShowReply(false)}
                onError={(err) => toast(err, "error")}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <EnvelopeIcon size={48} className="mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
              <p className="text-neutral-500 dark:text-neutral-400">Select a conversation to view</p>
            </div>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          accounts={accounts}
          onSent={() => {
            toast("Email sent");
            setShowCompose(false);
            fetchThreads();
          }}
          onClose={() => setShowCompose(false)}
          onError={(err) => toast(err, "error")}
        />
      )}

      <Toast open={showToast} onClose={() => setShowToast(false)} message={toastMessage} variant={toastVariant} />
    </div>
  );
}

// ── Reply Box ──────────────────────────────────────────────────────────────

function ReplyBox({
  threadId,
  accountId,
  accounts,
  onSent,
  onCancel,
  onError,
}: {
  threadId: string;
  accountId: string;
  accounts: EmailAccount[];
  onSent: () => void;
  onCancel: () => void;
  onError: (err: string) => void;
}) {
  const [to, setTo] = useState("");
  const [html, setHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(accountId);

  const handleSend = async () => {
    if (!html.trim()) return;
    setSending(true);
    const result = await sendReply({
      threadId,
      accountId: selectedAccount,
      to,
      html: `<div>${html.replace(/\n/g, "<br>")}</div>`,
    });
    setSending(false);
    if (result.error) onError(result.error);
    else onSent();
  };

  return (
    <div className="border-t border-neutral-200 dark:border-neutral-800 px-6 py-4 bg-neutral-50 dark:bg-neutral-900/50">
      <div className="flex items-center gap-3 mb-3">
        <Input
          placeholder="To"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="flex-1"
        />
        {accounts.length > 1 && (
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="text-sm rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-700 dark:text-neutral-300"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.email_address}</option>
            ))}
          </select>
        )}
      </div>
      <textarea
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        placeholder="Write your reply..."
        className="w-full min-h-[100px] text-sm rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-950 dark:text-neutral-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-500/30 resize-y"
      />
      <div className="flex justify-end gap-2 mt-3">
        <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={handleSend} disabled={sending || !html.trim()}>
          {sending ? <CircleNotchIcon size={14} className="animate-spin mr-1.5" /> : <PaperPlaneTiltIcon size={14} className="mr-1.5" />}
          Send
        </Button>
      </div>
    </div>
  );
}

// ── Compose Modal ──────────────────────────────────────────────────────────

function ComposeModal({
  accounts,
  onSent,
  onClose,
  onError,
}: {
  accounts: EmailAccount[];
  onSent: () => void;
  onClose: () => void;
  onError: (err: string) => void;
}) {
  const defaultAccount = accounts.find((a) => a.is_default) || accounts[0];
  const [selectedAccount, setSelectedAccount] = useState(defaultAccount?.id || "");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    const result = await composeAndSendEmail({
      accountId: selectedAccount,
      to,
      subject,
      html: `<div>${body.replace(/\n/g, "<br>")}</div>`,
    });
    setSending(false);
    if (result.error) onError(result.error);
    else onSent();
  };

  if (accounts.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50">
        <div className="bg-white dark:bg-neutral-900 rounded shadow-xl p-6 max-w-md w-full mx-4">
          <div className="flex items-center gap-3 mb-4">
            <WarningIcon size={24} className="text-amber-500" />
            <h3 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">No Email Accounts</h3>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
            Connect an email account in Settings before composing emails.
          </p>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 dark:bg-black/50">
      <div className="bg-white dark:bg-neutral-900 rounded-t-lg sm:rounded shadow-xl w-full max-w-2xl mx-0 sm:mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">New Email</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <XIcon size={16} className="text-neutral-500" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {accounts.length > 1 && (
            <div>
              <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">From</label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full text-sm rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-700 dark:text-neutral-300"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.display_name ? `${a.display_name} <${a.email_address}>` : a.email_address}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Input label="To" value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com" />
          <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" />
          <div>
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email..."
              className="w-full min-h-[200px] text-sm rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-950 dark:text-neutral-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-500/30 resize-y"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-neutral-200 dark:border-neutral-800">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !to.trim() || !subject.trim()}>
            {sending ? <CircleNotchIcon size={14} className="animate-spin mr-1.5" /> : <PaperPlaneTiltIcon size={14} className="mr-1.5" />}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
