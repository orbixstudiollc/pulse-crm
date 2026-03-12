"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PaperPlaneTiltIcon,
  DotsThreeVerticalIcon,
  PencilSimpleIcon,
  TrashIcon,
  CopyIcon,
  XIcon,
  CheckIcon,
  EnvelopeIcon,
  PulseIcon,
  UsersIcon,
  ChartBarIcon,
  GearIcon,
  ArrowRightIcon,
  WarningIcon,
  LightningIcon,
  SparkleIcon,
  EyeIcon,
  CursorClickIcon,
  StarIcon,
  ClockIcon,
  PlugsConnectedIcon,
  GoogleLogoIcon,
  MicrosoftOutlookLogoIcon,
  FunnelSimpleIcon,
} from "@/components/ui";
import {
  getCampaignsWithTags,
  getCampaignDashboardStats,
  getCampaignTags,
  createCampaignTag,
  deleteCampaignTag,
  updateSequenceTags,
  getEmailAccounts,
  createEmailAccount,
  updateEmailAccount,
  deleteEmailAccount,
  testEmailAccount,
  updateSequenceSchedule,
  assignEmailAccounts,
  type CampaignWithTags,
} from "@/lib/actions/campaigns";
import {
  createSequence,
  updateSequence,
  deleteSequence,
  cloneSequence,
} from "@/lib/actions/sequences";
import type { Database } from "@/types/database";

type EmailAccount = Database["public"]["Tables"]["email_accounts"]["Row"];
type CampaignTag = Database["public"]["Tables"]["campaign_tags"]["Row"];

// ── Count-up hook ───────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return value;
}

// ── Delete Confirm Modal ────────────────────────────────────────────────────

function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isPending: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 dark:bg-black/60" onClick={onClose} />
      <div className="relative bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-400/15 rounded">
            <WarningIcon className="w-5 h-5 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">{title}</h3>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50"
          >
            {isPending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tag Manager Modal ───────────────────────────────────────────────────────

function TagManagerModal({
  open,
  onClose,
  tags,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  tags: CampaignTag[];
  onRefresh: () => void;
}) {
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [isPending, startTransition] = useTransition();

  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6"];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 dark:bg-black/60" onClick={onClose} />
      <div className="relative bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">Manage Tags</h3>
          <button onClick={onClose} className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50"><XIcon className="w-5 h-5" /></button>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Tag name..."
            className="flex-1 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded text-sm text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
          />
          <button
            onClick={() => {
              if (!newTagName.trim()) return;
              startTransition(async () => {
                await createCampaignTag(newTagName.trim(), newTagColor);
                setNewTagName("");
                onRefresh();
              });
            }}
            disabled={isPending}
            className="px-3 py-2 bg-neutral-950 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-sm rounded"
          >
            Add
          </button>
        </div>

        <div className="flex gap-1.5 mb-4">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setNewTagColor(c)}
              className={`w-6 h-6 rounded-full border-2 ${newTagColor === c ? "border-white" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center justify-between py-2 px-3 bg-neutral-100 dark:bg-neutral-800 rounded">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                <span className="text-sm text-neutral-950 dark:text-neutral-50">{tag.name}</span>
              </div>
              <button
                onClick={() => {
                  startTransition(async () => {
                    await deleteCampaignTag(tag.id);
                    onRefresh();
                  });
                }}
                className="text-neutral-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
          {tags.length === 0 && <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-4">No tags yet</p>}
        </div>
      </div>
    </div>
  );
}

// ── Add Email Account Modal ─────────────────────────────────────────────────

function AddAccountModal({
  open,
  onClose,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [provider, setProvider] = useState<"gmail" | "microsoft" | "custom_imap">("custom_imap");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [dailyLimit, setDailyLimit] = useState("50");
  const [warmup, setWarmup] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 dark:bg-black/60" onClick={onClose} />
      <div className="relative bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 max-w-lg w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">Add Email Account</h3>
          <button onClick={onClose} className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50"><XIcon className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-500 dark:text-neutral-400 mb-1">Email Address</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
              className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded text-sm text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600" />
          </div>
          <div>
            <label className="block text-sm text-neutral-500 dark:text-neutral-400 mb-1">Display Name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="John Doe"
              className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded text-sm text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600" />
          </div>
          <div>
            <label className="block text-sm text-neutral-500 dark:text-neutral-400 mb-1">Provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value as "gmail" | "microsoft" | "custom_imap")}
              className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded text-sm text-neutral-950 dark:text-neutral-50 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600">
              <option value="gmail">Google Workspace</option>
              <option value="microsoft">Microsoft Outlook</option>
              <option value="custom_imap">Custom SMTP/IMAP</option>
            </select>
          </div>
          {provider === "custom_imap" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-neutral-500 dark:text-neutral-400 mb-1">SMTP Host</label>
                <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com"
                  className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded text-sm text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600" />
              </div>
              <div>
                <label className="block text-sm text-neutral-500 dark:text-neutral-400 mb-1">Port</label>
                <input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587"
                  className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded text-sm text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-neutral-500 dark:text-neutral-400 mb-1">Daily Send Limit</label>
              <input value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} type="number"
                className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded text-sm text-neutral-950 dark:text-neutral-50 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={warmup} onChange={(e) => setWarmup(e.target.checked)}
                  className="rounded border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50" />
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Enable Warmup</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50">Cancel</button>
          <button
            onClick={() => {
              if (!email.trim()) return;
              startTransition(async () => {
                const res = await createEmailAccount({
                  email_address: email.trim(),
                  display_name: displayName || undefined,
                  provider,
                  smtp_config: provider === "custom_imap" ? { host: smtpHost, port: parseInt(smtpPort) } : undefined,
                  daily_send_limit: parseInt(dailyLimit) || 50,
                  warmup_enabled: warmup,
                });
                if (res.error) { toast.error(res.error); return; }
                toast.success("Email account added");
                onClose();
                onRefresh();
              });
            }}
            disabled={isPending}
            className="px-4 py-2 text-sm bg-neutral-950 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-950 rounded disabled:opacity-50"
          >
            {isPending ? "Adding..." : "Add Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Performance Drawer ──────────────────────────────────────────────────────

function PerformanceDrawer({
  campaign,
  onClose,
}: {
  campaign: CampaignWithTags | null;
  onClose: () => void;
}) {
  const router = useRouter();
  if (!campaign) return null;

  const metrics = [
    { label: "Sent", value: campaign.total_sent, icon: EnvelopeIcon, color: "text-blue-400" },
    { label: "Opened", value: campaign.total_opened, icon: EyeIcon, color: "text-green-400" },
    { label: "Clicked", value: campaign.total_clicked, icon: CursorClickIcon, color: "text-amber-400" },
    { label: "Replied", value: campaign.total_replied, icon: PaperPlaneTiltIcon, color: "text-indigo-400" },
    { label: "Bounced", value: campaign.total_bounced, icon: WarningIcon, color: "text-red-400" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative w-full max-w-md bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 h-full overflow-y-auto"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">{campaign.name}</h3>
            <button onClick={onClose} className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50"><XIcon className="w-5 h-5" /></button>
          </div>

          {/* Status + Tags */}
          <div className="flex items-center gap-2 mb-6">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              campaign.status === "active" ? "border-[0.5px] border-green-200 dark:border-green-400/30 bg-green-100 text-green-600 dark:bg-green-400/15 dark:text-green-400" :
              campaign.status === "paused" ? "border-[0.5px] border-amber-200 dark:border-amber-400/30 bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400" :
              "bg-zinc-500/10 text-neutral-500 dark:text-neutral-400"
            }`}>{campaign.status}</span>
            {campaign.tags.map((t) => (
              <span key={t.id} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: t.color + "20", color: t.color }}>
                {t.name}
              </span>
            ))}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {metrics.map((m) => (
              <div key={m.label} className="bg-neutral-100 dark:bg-neutral-800 rounded p-3">
                <div className="flex items-center gap-2 mb-1">
                  <m.icon className={`w-4 h-4 ${m.color}`} />
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">{m.label}</span>
                </div>
                <span className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">{m.value.toLocaleString()}</span>
              </div>
            ))}
            <div className="bg-neutral-100 dark:bg-neutral-800 rounded p-3">
              <div className="flex items-center gap-2 mb-1">
                <UsersIcon className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Enrolled</span>
              </div>
              <span className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">{campaign.total_enrolled.toLocaleString()}</span>
            </div>
          </div>

          {/* Rates */}
          <div className="space-y-3 mb-6">
            {[
              { label: "Open Rate", value: campaign.open_rate, color: "bg-green-500" },
              { label: "Click Rate", value: campaign.click_rate, color: "bg-amber-500" },
              { label: "Reply Rate", value: campaign.reply_rate, color: "bg-indigo-500" },
            ].map((r) => (
              <div key={r.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-neutral-500 dark:text-neutral-400">{r.label}</span>
                  <span className="text-neutral-950 dark:text-neutral-50 font-medium">{r.value.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div className={`h-full ${r.color} rounded-full transition-all`} style={{ width: `${Math.min(r.value, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Quick Info */}
          <div className="bg-neutral-100 dark:bg-neutral-800 rounded p-4 mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Steps</span>
              <span className="text-neutral-950 dark:text-neutral-50">{campaign.total_steps}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Category</span>
              <span className="text-neutral-950 dark:text-neutral-50">{campaign.category.replace(/_/g, " ")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Priority</span>
              <span className="text-neutral-950 dark:text-neutral-50 capitalize">{campaign.priority ?? "normal"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Email Accounts</span>
              <span className="text-neutral-950 dark:text-neutral-50">{campaign.emailAccountCount}</span>
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={() => router.push(`/dashboard/sequences/${campaign.id}`)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-950 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-sm font-medium rounded transition-colors"
          >
            Edit Campaign <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

interface CampaignsPageProps {
  initialCampaigns: CampaignWithTags[];
  initialStats: {
    totalCampaigns: number;
    activeCampaigns: number;
    pausedCampaigns: number;
    draftCampaigns: number;
    totalEnrolled: number;
    totalSentToday: number;
    avgReplyRate: number;
    totalAccounts: number;
    activeAccounts: number;
  };
  initialTags: CampaignTag[];
  initialAccounts: EmailAccount[];
}

export function CampaignsPageClient({
  initialCampaigns,
  initialStats,
  initialTags,
  initialAccounts,
}: CampaignsPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Data state
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [stats, setStats] = useState(initialStats);
  const [tags, setTags] = useState(initialTags);
  const [accounts, setAccounts] = useState(initialAccounts);

  // UI state
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [drawerCampaign, setDrawerCampaign] = useState<CampaignWithTags | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  // Animated stats
  const animActive = useCountUp(stats.activeCampaigns);
  const animEnrolled = useCountUp(stats.totalEnrolled);
  const animSentToday = useCountUp(stats.totalSentToday);
  const animReplyRate = useCountUp(stats.avgReplyRate * 10) / 10;
  const animAccounts = useCountUp(stats.activeAccounts);

  const tabs = [
    { key: "all", label: "All", count: stats.totalCampaigns },
    { key: "active", label: "Active", count: stats.activeCampaigns },
    { key: "paused", label: "Paused", count: stats.pausedCampaigns },
    { key: "draft", label: "Drafts", count: stats.draftCampaigns },
    { key: "accounts", label: "Accounts", count: stats.totalAccounts },
  ];

  // Refresh data
  const refresh = useCallback(() => {
    startTransition(async () => {
      const [c, s, t, a] = await Promise.all([
        getCampaignsWithTags({ search: searchQuery || undefined, status: activeTab !== "all" && activeTab !== "accounts" ? activeTab : undefined, tagId: selectedTag || undefined }),
        getCampaignDashboardStats(),
        getCampaignTags(),
        getEmailAccounts(),
      ]);
      setCampaigns(c.data);
      setStats(s.data);
      setTags(t.data);
      setAccounts(a.data);
    });
  }, [searchQuery, activeTab, selectedTag]);

  // Filter campaigns client-side
  const filtered = campaigns.filter((c) => {
    if (activeTab === "active" && c.status !== "active") return false;
    if (activeTab === "paused" && c.status !== "paused") return false;
    if (activeTab === "draft" && c.status !== "draft") return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.description?.toLowerCase().includes(q)) return false;
    }
    if (selectedTag && !c.tags.some((t) => t.id === selectedTag)) return false;
    return true;
  });

  // Handlers
  const handleNewCampaign = () => {
    startTransition(async () => {
      const res = await createSequence({ name: "New Campaign", category: "cold_outreach" });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Campaign created");
      router.push(`/dashboard/sequences/${res.data?.id}`);
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteSequence(id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Campaign deleted");
      setDeleteTarget(null);
      refresh();
    });
  };

  const handleClone = (id: string) => {
    startTransition(async () => {
      const res = await cloneSequence(id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Campaign cloned");
      setActionMenuId(null);
      refresh();
    });
  };

  const handleToggleStatus = (id: string, currentStatus: string) => {
    startTransition(async () => {
      const newStatus = currentStatus === "active" ? "paused" : "active";
      const res = await updateSequence(id, { status: newStatus as "active" | "paused" });
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Campaign ${newStatus}`);
      refresh();
    });
  };

  const handleDeleteAccount = (id: string) => {
    startTransition(async () => {
      const res = await deleteEmailAccount(id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Account removed");
      refresh();
    });
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === filtered.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filtered.map((c) => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── KPI Cards ─────────────────────────────────────────────────────────

  const kpis = [
    { label: "Active Campaigns", value: animActive, icon: LightningIcon, color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-400/15" },
    { label: "Leads in Campaigns", value: animEnrolled, icon: UsersIcon, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-400/15" },
    { label: "Sent Today", value: animSentToday, icon: EnvelopeIcon, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { label: "Avg Reply Rate", value: `${animReplyRate}%`, icon: PaperPlaneTiltIcon, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-100 dark:bg-indigo-400/15" },
    { label: "Active Accounts", value: animAccounts, icon: PlugsConnectedIcon, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-400/15" },
  ];

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] leading-[36px] tracking-[-0.56px] font-serif text-neutral-950 dark:text-neutral-50">Campaigns</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Manage your outreach campaigns, email accounts, and send schedules</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowTagManager(true)} className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 border border-neutral-200 dark:border-neutral-800 rounded hover:bg-neutral-100 dark:bg-neutral-800 transition-colors">
            Tags
          </button>
          <button onClick={handleNewCampaign} disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-950 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-sm font-medium rounded transition-colors disabled:opacity-50">
            <PlusIcon className="w-4 h-4" /> New Campaign
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
            <div className="flex items-start justify-between p-5">
              <div className="space-y-2">
                <p className="text-xs font-normal uppercase leading-5 text-neutral-500 dark:text-neutral-400">{kpi.label}</p>
                <p className="text-[32px] leading-[40px] tracking-[-0.64px] font-serif text-neutral-950 dark:text-neutral-50">{typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}</p>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800">
                <kpi.icon className="w-6 h-6 text-neutral-950 dark:text-neutral-50" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedRows(new Set()); }}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === tab.key ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950" : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50"
              }`}
            >
              {tab.label} <span className="text-xs opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>

        {activeTab !== "accounts" && (
          <div className="flex items-center gap-3">
            {tags.length > 0 && (
              <select
                value={selectedTag ?? ""}
                onChange={(e) => setSelectedTag(e.target.value || null)}
                className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded text-sm text-neutral-950 dark:text-neutral-50 focus:outline-none"
              >
                <option value="">All Tags</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search campaigns..."
                className="pl-9 pr-3 py-1.5 w-64 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded text-sm text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
              />
            </div>
          </div>
        )}
      </div>

      {/* Campaign List or Accounts Tab */}
      <AnimatePresence mode="wait">
        {activeTab === "accounts" ? (
          <motion.div key="accounts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            {/* Accounts Tab */}
            <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-4">
                  <h3 className="text-sm font-medium text-neutral-950 dark:text-neutral-50">Email Accounts</h3>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="px-2 py-0.5 border-[0.5px] border-green-200 dark:border-green-400/30 bg-green-100 text-green-600 dark:bg-green-400/15 dark:text-green-400 rounded-full">
                      {accounts.filter((a) => a.status === "active").length} active
                    </span>
                    <span className="px-2 py-0.5 border-[0.5px] border-amber-200 dark:border-amber-400/30 bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400 rounded-full">
                      {accounts.filter((a) => a.status === "warming_up").length} warming
                    </span>
                  </div>
                </div>
                <button onClick={() => setShowAddAccount(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-neutral-950 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-sm rounded">
                  <PlusIcon className="w-4 h-4" /> Add Account
                </button>
              </div>

              {accounts.length === 0 ? (
                <div className="p-12 text-center">
                  <PlugsConnectedIcon className="w-10 h-10 text-neutral-400 dark:text-neutral-500 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">No email accounts connected yet</p>
                  <button onClick={() => setShowAddAccount(true)}
                    className="px-4 py-2 bg-neutral-950 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-sm rounded">
                    Add Your First Account
                  </button>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800">
                      <th className="text-left text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Email</th>
                      <th className="text-left text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Provider</th>
                      <th className="text-left text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Status</th>
                      <th className="text-left text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Daily Limit</th>
                      <th className="text-left text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Reputation</th>
                      <th className="text-left text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Warmup</th>
                      <th className="text-right text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((acc) => (
                      <tr key={acc.id} className="border-b border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {acc.provider === "gmail" ? <GoogleLogoIcon className="w-4 h-4 text-neutral-500 dark:text-neutral-400" /> :
                             acc.provider === "microsoft" ? <MicrosoftOutlookLogoIcon className="w-4 h-4 text-neutral-500 dark:text-neutral-400" /> :
                             <EnvelopeIcon className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />}
                            <div>
                              <span className="text-sm text-neutral-950 dark:text-neutral-50">{acc.email_address}</span>
                              {acc.display_name && <span className="text-xs text-neutral-400 dark:text-neutral-500 ml-2">{acc.display_name}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400 capitalize">{acc.provider}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            acc.status === "active" ? "border-[0.5px] border-green-200 dark:border-green-400/30 bg-green-100 text-green-600 dark:bg-green-400/15 dark:text-green-400" :
                            acc.status === "warming_up" ? "border-[0.5px] border-amber-200 dark:border-amber-400/30 bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400" :
                            acc.status === "error" ? "border-[0.5px] border-red-200 dark:border-red-400/30 bg-red-100 text-red-600 dark:bg-red-400/15 dark:text-red-400" :
                            "bg-zinc-500/10 text-neutral-500 dark:text-neutral-400"
                          }`}>{acc.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((acc.daily_sent_count / acc.daily_send_limit) * 100, 100)}%` }} />
                            </div>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400">{acc.daily_sent_count}/{acc.daily_send_limit}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${Number(acc.reputation_score) >= 80 ? "bg-emerald-500" : Number(acc.reputation_score) >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${acc.reputation_score}%` }} />
                            </div>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400">{Math.round(Number(acc.reputation_score))}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {acc.warmup_enabled ? (
                            <span className="px-2 py-0.5 border-[0.5px] border-amber-200 dark:border-amber-400/30 bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400 rounded-full text-xs">
                              {acc.warmup_limit}/day
                            </span>
                          ) : (
                            <span className="text-xs text-neutral-400 dark:text-neutral-500">Off</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDeleteAccount(acc.id)} className="text-neutral-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="campaigns" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            {/* Bulk actions */}
            {selectedRows.size > 0 && (
              <div className="flex items-center gap-3 mb-3 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded">
                <span className="text-sm text-neutral-700 dark:text-neutral-300">{selectedRows.size} selected</span>
                <button onClick={() => setSelectedRows(new Set())} className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50">Clear</button>
              </div>
            )}

            {/* Campaign Table */}
            <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
              {filtered.length === 0 ? (
                <div className="p-12 text-center">
                  <PaperPlaneTiltIcon className="w-10 h-10 text-neutral-400 dark:text-neutral-500 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                    {searchQuery || selectedTag ? "No campaigns match your filters" : "No campaigns yet"}
                  </p>
                  {!searchQuery && !selectedTag && (
                    <button onClick={handleNewCampaign} className="px-4 py-2 bg-neutral-950 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-sm rounded">
                      Create Your First Campaign
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800">
                      <th className="w-10 px-4 py-3">
                        <input type="checkbox" checked={selectedRows.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll}
                          className="rounded border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50" />
                      </th>
                      <th className="text-left text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Campaign</th>
                      <th className="text-left text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Status</th>
                      <th className="text-left text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Tags</th>
                      <th className="text-right text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Enrolled</th>
                      <th className="text-right text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Sent</th>
                      <th className="text-right text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Opened</th>
                      <th className="text-right text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Replied</th>
                      <th className="text-right text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Reply Rate</th>
                      <th className="text-right text-xs text-neutral-400 dark:text-neutral-500 font-medium px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((campaign) => (
                      <tr key={campaign.id} className="border-b border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
                        onClick={() => setDrawerCampaign(campaign)}>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedRows.has(campaign.id)} onChange={() => toggleSelect(campaign.id)}
                            className="rounded border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50" />
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{campaign.name}</span>
                            {campaign.description && <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 truncate max-w-[200px]">{campaign.description}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleStatus(campaign.id, campaign.status)}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                              campaign.status === "active" ? "border-[0.5px] border-green-200 dark:border-green-400/30 bg-green-100 text-green-600 dark:bg-green-400/15 dark:text-green-400 hover:bg-emerald-500/20" :
                              campaign.status === "paused" ? "border-[0.5px] border-amber-200 dark:border-amber-400/30 bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400 hover:bg-amber-500/20" :
                              "bg-zinc-500/10 text-neutral-500 dark:text-neutral-400"
                            }`}
                          >
                            {campaign.status}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {campaign.tags.slice(0, 3).map((t) => (
                              <span key={t.id} className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{ backgroundColor: t.color + "20", color: t.color }}>
                                {t.name}
                              </span>
                            ))}
                            {campaign.tags.length > 3 && (
                              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">+{campaign.tags.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-neutral-700 dark:text-neutral-300">{campaign.total_enrolled.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-sm text-neutral-700 dark:text-neutral-300">{campaign.total_sent.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-sm text-neutral-700 dark:text-neutral-300">{campaign.total_opened.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-sm text-neutral-700 dark:text-neutral-300">{campaign.total_replied.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-medium ${
                            campaign.reply_rate >= 10 ? "text-emerald-400" :
                            campaign.reply_rate >= 5 ? "text-amber-400" : "text-neutral-500 dark:text-neutral-400"
                          }`}>{campaign.reply_rate.toFixed(1)}%</span>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="relative">
                            <button onClick={() => setActionMenuId(actionMenuId === campaign.id ? null : campaign.id)}
                              className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-950 dark:hover:text-neutral-50 p-1">
                              <DotsThreeVerticalIcon className="w-4 h-4" />
                            </button>
                            {actionMenuId === campaign.id && (
                              <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded shadow-xl z-30 py-1">
                                <button onClick={() => { router.push(`/dashboard/sequences/${campaign.id}`); setActionMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:bg-neutral-800">
                                  <PencilSimpleIcon className="w-4 h-4" /> Edit
                                </button>
                                <button onClick={() => handleClone(campaign.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:bg-neutral-800">
                                  <CopyIcon className="w-4 h-4" /> Clone
                                </button>
                                <button onClick={() => { setDeleteTarget({ id: campaign.id, name: campaign.name }); setActionMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-neutral-100 dark:bg-neutral-800">
                                  <TrashIcon className="w-4 h-4" /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {drawerCampaign && <PerformanceDrawer campaign={drawerCampaign} onClose={() => setDrawerCampaign(null)} />}
      </AnimatePresence>
      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
        title="Delete Campaign"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will remove all steps, enrollments, and events. This action cannot be undone.`}
        isPending={isPending}
      />
      <TagManagerModal open={showTagManager} onClose={() => setShowTagManager(false)} tags={tags} onRefresh={refresh} />
      <AddAccountModal open={showAddAccount} onClose={() => setShowAddAccount(false)} onRefresh={refresh} />
    </div>
  );
}
