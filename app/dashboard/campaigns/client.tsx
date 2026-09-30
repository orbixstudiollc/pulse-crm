"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PaperPlaneTiltIcon,
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
  Button,
  ActionMenu,
} from "@/components/ui";
import {
  Page,
  PageHeader,
  MetricStrip,
  PageTabs,
  TableSection,
  StatCard,
} from "@/components/dashboard";
import {
  getCampaignsWithTags,
  getCampaignDashboardStats,
  getCampaignTags,
  createCampaignTag,
  deleteCampaignTag,
  updateSequenceTags,
  getEmailAccounts,
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

type EmailAccount = Omit<Database["public"]["Tables"]["email_accounts"]["Row"], "oauth_tokens" | "smtp_config" | "imap_config">;
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
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative rounded-lg border border-line bg-surface shadow-modal p-4 max-w-md w-full mx-4" data-clay-box>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-danger-surface rounded">
            <WarningIcon className="w-5 h-5 text-danger" />
          </div>
          <h3 className="text-lg font-semibold text-fg">{title}</h3>
        </div>
        <p className="text-sm text-fg-secondary mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-fg-secondary hover:text-fg transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 text-sm bg-danger hover:opacity-90 text-on-inverse rounded transition-colors disabled:opacity-50"
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
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative rounded-lg border border-line bg-surface shadow-modal p-4 max-w-md w-full mx-4" data-clay-box>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-fg">Manage Tags</h3>
          <button onClick={onClose} className="text-fg-secondary hover:text-fg"><XIcon className="w-5 h-5" /></button>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Tag name..."
            className="flex-1 px-3 py-2 bg-muted border border-line rounded text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent"
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
            className="px-3 py-2 bg-inverse hover:opacity-90 text-on-inverse text-sm rounded"
          >
            Add
          </button>
        </div>

        <div className="flex gap-1.5 mb-4">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setNewTagColor(c)}
              className={`w-6 h-6 rounded-full border ${newTagColor === c ? "border-white" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center justify-between py-2 px-3 bg-muted rounded">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                <span className="text-sm text-fg">{tag.name}</span>
              </div>
              <button
                onClick={() => {
                  startTransition(async () => {
                    await deleteCampaignTag(tag.id);
                    onRefresh();
                  });
                }}
                className="text-fg-muted hover:text-danger"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
          {tags.length === 0 && <p className="text-sm text-fg-secondary text-center py-4">No tags yet</p>}
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
    { label: "Sent", value: campaign.total_sent, icon: EnvelopeIcon, color: "text-accent-strong" },
    { label: "Opened", value: campaign.total_opened, icon: EyeIcon, color: "text-success" },
    { label: "Clicked", value: campaign.total_clicked, icon: CursorClickIcon, color: "text-warning" },
    { label: "Replied", value: campaign.total_replied, icon: PaperPlaneTiltIcon, color: "text-accent-strong" },
    { label: "Bounced", value: campaign.total_bounced, icon: WarningIcon, color: "text-danger" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative w-full max-w-md bg-surface border-l border-line h-full overflow-y-auto"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-fg">{campaign.name}</h3>
            <button onClick={onClose} className="text-fg-secondary hover:text-fg"><XIcon className="w-5 h-5" /></button>
          </div>

          {/* Status + Tags */}
          <div className="flex items-center gap-2 mb-6">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              campaign.status === "active" ? "bg-success-surface text-success" :
              campaign.status === "paused" ? "bg-warning-surface text-warning" :
              "bg-muted text-fg-secondary"
            }`}>{campaign.status}</span>
            {campaign.tags.map((t) => (
              <span key={t.id} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: t.color + "20", color: t.color }}>
                {t.name}
              </span>
            ))}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6 pt-6 border-t border-divider">
            {metrics.map((m) => (
              <div key={m.label}>
                <div className="flex items-center gap-2 mb-1">
                  <m.icon className={`w-4 h-4 ${m.color}`} />
                  <span className="text-xs text-fg-secondary">{m.label}</span>
                </div>
                <span className="text-lg font-semibold text-fg">{m.value.toLocaleString()}</span>
              </div>
            ))}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <UsersIcon className="w-4 h-4 text-accent-strong" />
                <span className="text-xs text-fg-secondary">Enrolled</span>
              </div>
              <span className="text-lg font-semibold text-fg">{campaign.total_enrolled.toLocaleString()}</span>
            </div>
          </div>

          {/* Rates */}
          <div className="space-y-3 mb-6">
            {[
              { label: "Open Rate", value: campaign.open_rate, color: "bg-success" },
              { label: "Click Rate", value: campaign.click_rate, color: "bg-warning" },
              { label: "Reply Rate", value: campaign.reply_rate, color: "bg-accent-strong" },
            ].map((r) => (
              <div key={r.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-fg-secondary">{r.label}</span>
                  <span className="text-fg font-medium">{r.value.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${r.color} rounded-full transition-all`} style={{ width: `${Math.min(r.value, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Quick Info */}
          <div className="pt-6 border-t border-divider mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-fg-secondary">Steps</span>
              <span className="text-fg">{campaign.total_steps}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-fg-secondary">Category</span>
              <span className="text-fg">{campaign.category.replace(/_/g, " ")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-fg-secondary">Priority</span>
              <span className="text-fg capitalize">{campaign.priority ?? "normal"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-fg-secondary">Email Accounts</span>
              <span className="text-fg">{campaign.emailAccountCount}</span>
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={() => router.push(`/dashboard/sequences/${campaign.id}`)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-inverse hover:opacity-90 text-on-inverse text-sm font-medium rounded transition-colors"
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

  // Animated stats
  const animActive = useCountUp(stats.activeCampaigns);
  const animEnrolled = useCountUp(stats.totalEnrolled);
  const animSentToday = useCountUp(stats.totalSentToday);
  const animReplyRate = useCountUp(stats.avgReplyRate * 10) / 10;
  const animAccounts = useCountUp(stats.activeAccounts);

  const tabs = [
    { id: "all", label: "All", count: stats.totalCampaigns },
    { id: "active", label: "Active", count: stats.activeCampaigns },
    { id: "paused", label: "Paused", count: stats.pausedCampaigns },
    { id: "draft", label: "Drafts", count: stats.draftCampaigns },
    { id: "accounts", label: "Accounts", count: stats.totalAccounts },
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
    { label: "Active Campaigns", value: animActive, icon: LightningIcon, color: "text-success", bg: "bg-success-surface" },
    { label: "Leads in Campaigns", value: animEnrolled, icon: UsersIcon, color: "text-accent-strong", bg: "bg-accent-surface" },
    { label: "Sent Today", value: animSentToday, icon: EnvelopeIcon, color: "text-accent-strong", bg: "bg-accent-surface" },
    { label: "Avg Reply Rate", value: `${animReplyRate}%`, icon: PaperPlaneTiltIcon, color: "text-accent-strong", bg: "bg-accent-surface" },
    { label: "Active Accounts", value: animAccounts, icon: PlugsConnectedIcon, color: "text-warning", bg: "bg-warning-surface" },
  ];

  return (
    <Page>
      {/* Header */}
      <PageHeader
        title="Campaigns"
        description="Manage your outreach campaigns, email accounts, and send schedules"
        icon={<PaperPlaneTiltIcon size={18} />}
      >
        <Button variant="secondary" onClick={() => setShowTagManager(true)}>
          Tags
        </Button>
        <Button onClick={handleNewCampaign} disabled={isPending} leftIcon={<PlusIcon className="w-4 h-4" />}>
          New Campaign
        </Button>
      </PageHeader>

      {/* KPI Metrics */}
      <MetricStrip>
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            value={typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}
            icon={<kpi.icon className="w-4 h-4" />}
          />
        ))}
      </MetricStrip>

      {/* Tabs */}
      <PageTabs
        tabs={tabs}
        value={activeTab}
        onChange={(id) => { setActiveTab(id); setSelectedRows(new Set()); }}
        className="max-sm:overflow-x-auto max-sm:overflow-y-hidden"
      />

      {/* Search + tag filter */}
      {activeTab !== "accounts" && (
        <div className="flex flex-wrap items-center gap-3 px-8 max-sm:px-4 py-2">
          {tags.length > 0 && (
            <select
              value={selectedTag ?? ""}
              onChange={(e) => setSelectedTag(e.target.value || null)}
              className="px-3 py-1.5 bg-muted border border-line rounded text-sm text-fg focus:outline-none"
            >
              <option value="">All Tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search campaigns..."
              className="pl-9 pr-3 py-1.5 w-64 bg-muted border border-line rounded text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      )}

      {/* Campaign List or Accounts Tab */}
      <AnimatePresence mode="wait">
        {activeTab === "accounts" ? (
          <motion.div key="accounts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            {/* Accounts Tab */}
            <div className="flex h-14 items-center justify-between gap-4 px-8 max-sm:px-4">
              <div className="flex items-center gap-4">
                <h3 className="text-[18px] leading-6 font-semibold text-fg">Email Accounts</h3>
                <div className="flex items-center gap-2 text-xs text-fg-secondary">
                  <span className="px-2 py-0.5 bg-success-surface text-success rounded-full">
                    {accounts.filter((a) => a.status === "active").length} active
                  </span>
                  <span className="px-2 py-0.5 bg-warning-surface text-warning rounded-full">
                    {accounts.filter((a) => a.status === "warming_up").length} warming
                  </span>
                </div>
              </div>
              <Link href="/dashboard/settings?tab=email-accounts"
                className="inline-flex items-center gap-1.5 h-8 px-3 bg-accent-strong hover:bg-accent-strong/90 text-on-inverse text-[14px] font-medium rounded-md transition-colors">
                <PlusIcon className="w-4 h-4" /> Add Account
              </Link>
            </div>

            {accounts.length === 0 ? (
              <div className="p-12 text-center border-t border-divider">
                <PlugsConnectedIcon className="w-10 h-10 text-fg-muted mx-auto mb-3" />
                <p className="text-sm text-fg-secondary mb-4">No email accounts connected yet</p>
                <Link href="/dashboard/settings?tab=email-accounts"
                  className="inline-flex items-center h-8 px-3 bg-accent-strong hover:bg-accent-strong/90 text-on-inverse text-[14px] font-medium rounded-md transition-colors">
                  Add Your First Account
                </Link>
              </div>
            ) : (
              <TableSection>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left text-[13px] font-medium text-fg-secondary">Email</th>
                        <th className="text-left text-[13px] font-medium text-fg-secondary">Provider</th>
                        <th className="text-left text-[13px] font-medium text-fg-secondary">Status</th>
                        <th className="text-left text-[13px] font-medium text-fg-secondary">Daily Limit</th>
                        <th className="text-left text-[13px] font-medium text-fg-secondary">Reputation</th>
                        <th className="text-left text-[13px] font-medium text-fg-secondary">Warmup</th>
                        <th className="text-right text-[13px] font-medium text-fg-secondary">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((acc) => (
                        <tr key={acc.id} className="hover:bg-subtle transition-colors">
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              {acc.provider === "gmail" ? <GoogleLogoIcon className="w-4 h-4 text-fg-muted" /> :
                               acc.provider === "microsoft" ? <MicrosoftOutlookLogoIcon className="w-4 h-4 text-fg-muted" /> :
                               <EnvelopeIcon className="w-4 h-4 text-fg-muted" />}
                              <div>
                                <span className="text-sm text-fg">{acc.email_address}</span>
                                {acc.display_name && <span className="text-xs text-fg-muted ml-2">{acc.display_name}</span>}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 text-[14px] text-fg-secondary capitalize">{acc.provider}</td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              acc.status === "active" ? "bg-success-surface text-success" :
                              acc.status === "warming_up" ? "bg-warning-surface text-warning" :
                              acc.status === "error" ? "bg-danger-surface text-danger" :
                              "bg-muted text-fg-secondary"
                            }`}>{acc.status}</span>
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-accent-strong rounded-full" style={{ width: `${Math.min((acc.daily_sent_count / acc.daily_send_limit) * 100, 100)}%` }} />
                              </div>
                              <span className="text-xs text-fg-secondary">{acc.daily_sent_count}/{acc.daily_send_limit}</span>
                            </div>
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${Number(acc.reputation_score) >= 80 ? "bg-success" : Number(acc.reputation_score) >= 50 ? "bg-warning" : "bg-danger"}`}
                                  style={{ width: `${acc.reputation_score}%` }} />
                              </div>
                              <span className="text-xs text-fg-secondary">{Math.round(Number(acc.reputation_score))}</span>
                            </div>
                          </td>
                          <td className="py-2">
                            {acc.warmup_enabled ? (
                              <span className="px-2 py-0.5 bg-warning-surface text-warning rounded-full text-xs">
                                {acc.warmup_limit}/day
                              </span>
                            ) : (
                              <span className="text-xs text-fg-muted">Off</span>
                            )}
                          </td>
                          <td className="py-2 text-right">
                            <div className="flex justify-end">
                              <button onClick={() => handleDeleteAccount(acc.id)} className="text-fg-muted hover:text-danger">
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TableSection>
            )}
          </motion.div>
        ) : (
          <motion.div key="campaigns" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            {/* Bulk actions */}
            {selectedRows.size > 0 && (
              <div className="flex h-10 items-center gap-3 px-8 max-sm:px-4 border-t border-divider">
                <span className="text-sm text-fg">{selectedRows.size} selected</span>
                <button onClick={() => setSelectedRows(new Set())} className="text-xs text-fg-secondary hover:text-fg">Clear</button>
              </div>
            )}

            {/* Campaign Table */}
            {filtered.length === 0 ? (
              <div className="p-12 text-center border-t border-divider">
                <PaperPlaneTiltIcon className="w-10 h-10 text-fg-muted mx-auto mb-3" />
                <p className="text-sm text-fg-secondary mb-4">
                  {searchQuery || selectedTag ? "No campaigns match your filters" : "No campaigns yet"}
                </p>
                {!searchQuery && !selectedTag && (
                  <Button onClick={handleNewCampaign}>
                    Create Your First Campaign
                  </Button>
                )}
              </div>
            ) : (
              <TableSection>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left text-[13px] font-medium text-fg-secondary w-10">
                          <input type="checkbox" checked={selectedRows.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll}
                            className="rounded border-line bg-muted text-fg" />
                        </th>
                        <th className="text-left text-[13px] font-medium text-fg-secondary">Campaign</th>
                        <th className="text-left text-[13px] font-medium text-fg-secondary">Status</th>
                        <th className="text-left text-[13px] font-medium text-fg-secondary">Tags</th>
                        <th className="text-right text-[13px] font-medium text-fg-secondary">Enrolled</th>
                        <th className="text-right text-[13px] font-medium text-fg-secondary">Sent</th>
                        <th className="text-right text-[13px] font-medium text-fg-secondary">Opened</th>
                        <th className="text-right text-[13px] font-medium text-fg-secondary">Replied</th>
                        <th className="text-right text-[13px] font-medium text-fg-secondary">Reply Rate</th>
                        <th className="text-right text-[13px] font-medium text-fg-secondary">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((campaign) => (
                        <tr key={campaign.id} className="hover:bg-subtle transition-colors cursor-pointer"
                          onClick={() => setDrawerCampaign(campaign)}>
                          <td className="py-2" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedRows.has(campaign.id)} onChange={() => toggleSelect(campaign.id)}
                              className="rounded border-line bg-muted text-fg" />
                          </td>
                          <td className="py-2">
                            <div className="flex items-start gap-2">
                              <PaperPlaneTiltIcon size={16} className="mt-0.5 shrink-0 text-fg-muted" />
                              <div>
                                <span className="text-sm font-medium text-fg">{campaign.name}</span>
                                {campaign.description && <p className="text-xs text-fg-muted mt-0.5 truncate max-w-[200px]">{campaign.description}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="py-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleToggleStatus(campaign.id, campaign.status)}
                              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                                campaign.status === "active" ? "bg-success-surface text-success hover:bg-success-surface" :
                                campaign.status === "paused" ? "bg-warning-surface text-warning hover:bg-warning-surface" :
                                "bg-muted text-fg-secondary"
                              }`}
                            >
                              {campaign.status}
                            </button>
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-1">
                              {campaign.tags.slice(0, 3).map((t) => (
                                <span key={t.id} className="px-1.5 py-0.5 rounded text-xs font-medium"
                                  style={{ backgroundColor: t.color + "20", color: t.color }}>
                                  {t.name}
                                </span>
                              ))}
                              {campaign.tags.length > 3 && (
                                <span className="text-xs text-fg-muted">+{campaign.tags.length - 3}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 text-right text-[14px] text-fg">{campaign.total_enrolled.toLocaleString()}</td>
                          <td className="py-2 text-right text-[14px] text-fg">{campaign.total_sent.toLocaleString()}</td>
                          <td className="py-2 text-right text-[14px] text-fg">{campaign.total_opened.toLocaleString()}</td>
                          <td className="py-2 text-right text-[14px] text-fg">{campaign.total_replied.toLocaleString()}</td>
                          <td className="py-2 text-right">
                            <span className={`text-sm font-medium ${
                              campaign.reply_rate >= 10 ? "text-success" :
                              campaign.reply_rate >= 5 ? "text-warning" : "text-fg-secondary"
                            }`}>{campaign.reply_rate.toFixed(1)}%</span>
                          </td>
                          <td className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end">
                              <ActionMenu
                                items={[
                                  {
                                    label: "Edit",
                                    icon: <PencilSimpleIcon size={18} />,
                                    onClick: () => router.push(`/dashboard/sequences/${campaign.id}`),
                                  },
                                  {
                                    label: "Clone",
                                    icon: <CopyIcon size={18} />,
                                    onClick: () => handleClone(campaign.id),
                                  },
                                  {
                                    label: "Delete",
                                    icon: <TrashIcon size={18} />,
                                    onClick: () => setDeleteTarget({ id: campaign.id, name: campaign.name }),
                                    variant: "danger",
                                  },
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TableSection>
            )}
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
    </Page>
  );
}
