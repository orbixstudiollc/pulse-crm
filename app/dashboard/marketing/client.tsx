"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Button,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  SparkleIcon,
  ChartBarIcon,
  FileTextIcon,
  CheckCircleIcon,
  ClockIcon,
  WarningIcon,
  ArrowRightIcon,
} from "@/components/ui";
import { PageHeader } from "@/components/dashboard";
import { cn } from "@/lib/utils";
import { deleteMarketingAudit, updateMarketingActionItem } from "@/lib/actions/marketing";

// ── Types ────────────────────────────────────────────────────────────────────

interface Audit {
  id: string;
  website_url: string;
  business_name: string | null;
  business_type: string | null;
  audit_type: string;
  status: string;
  progress: number;
  overall_score: number | null;
  grade: string | null;
  summary: string | null;
  created_at: string;
}

interface Content {
  id: string;
  content_type: string;
  title: string;
  status: string;
  created_at: string;
  audit_id: string | null;
}

interface Report {
  id: string;
  report_type: string;
  title: string;
  audit_id: string;
  created_at: string;
}

interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  tier: string;
  priority: string;
  status: string;
  impact_estimate: string | null;
  effort: string | null;
  audit_id: string;
}

interface MarketingPageClientProps {
  initialAudits: Audit[];
  initialContent: Content[];
  initialReports: Report[];
  initialActions: ActionItem[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "audits", label: "Audits", icon: ChartBarIcon },
  { id: "content", label: "Content", icon: SparkleIcon },
  { id: "reports", label: "Reports", icon: FileTextIcon },
  { id: "actions", label: "Action Plan", icon: CheckCircleIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (!score) return "text-neutral-400";
  if (score >= 85) return "text-green-600 dark:text-green-400";
  if (score >= 70) return "text-blue-600 dark:text-blue-400";
  if (score >= 55) return "text-amber-600 dark:text-amber-400";
  if (score >= 40) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBg(score: number | null): string {
  if (!score) return "bg-neutral-100 dark:bg-neutral-800";
  if (score >= 85) return "bg-green-50 dark:bg-green-950/30";
  if (score >= 70) return "bg-blue-50 dark:bg-blue-950/30";
  if (score >= 55) return "bg-amber-50 dark:bg-amber-950/30";
  if (score >= 40) return "bg-orange-50 dark:bg-orange-950/30";
  return "bg-red-50 dark:bg-red-950/30";
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400" },
    running: { label: "Running", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    completed: { label: "Completed", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    failed: { label: "Failed", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  };
  const info = map[status] || map.pending;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", info.className)}>
      {info.label}
    </span>
  );
}

function priorityBadge(priority: string) {
  const map: Record<string, string> = {
    critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", map[priority] || map.medium)}>
      {priority}
    </span>
  );
}

function contentTypeBadge(type: string) {
  const labels: Record<string, string> = {
    email_sequence: "Email Sequence",
    social_calendar: "Social Calendar",
    ad_campaign: "Ad Campaign",
    launch_playbook: "Launch Playbook",
    client_proposal: "Proposal",
    brand_voice: "Brand Voice",
  };
  return (
    <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 text-xs font-medium">
      {labels[type] || type}
    </span>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Score Gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score, size = 56 }: { score: number | null; size?: number }) {
  const s = score ?? 0;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (s / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={4} className="text-neutral-200 dark:text-neutral-700" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={4}
          strokeLinecap="round"
          className={scoreColor(score)}
          stroke="currentColor"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1, ease: "easeOut" }}
          strokeDasharray={circumference}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("text-sm font-bold", scoreColor(score))}>{score ?? "—"}</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function MarketingPageClient({
  initialAudits,
  initialContent,
  initialReports,
  initialActions,
}: MarketingPageClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("audits");
  const [isPending, startTransition] = useTransition();

  const handleDeleteAudit = (id: string) => {
    startTransition(async () => {
      const result = await deleteMarketingAudit(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Audit deleted");
        router.refresh();
      }
    });
  };

  const handleToggleAction = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    startTransition(async () => {
      await updateMarketingActionItem(id, {
        status: newStatus,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      });
      router.refresh();
    });
  };

  // ── Render tabs ──────────────────────────────────────────────────────────

  function renderAuditsTab() {
    if (initialAudits.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ChartBarIcon className="h-12 w-12 text-neutral-300 dark:text-neutral-600 mb-4" weight="regular" />
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">No marketing audits yet</h3>
          <p className="mt-1 text-sm text-neutral-500">Run your first audit to analyze a website&apos;s marketing effectiveness.</p>
          <Button className="mt-4" onClick={() => router.push("/dashboard/marketing/new")}>
            <PlusIcon className="h-4 w-4 mr-2" weight="bold" />
            New Audit
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {initialAudits.map((audit) => (
          <div
            key={audit.id}
            className="flex items-center gap-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors cursor-pointer"
            onClick={() => router.push(`/dashboard/marketing/${audit.id}`)}
          >
            <ScoreGauge score={audit.overall_score} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {audit.business_name || audit.website_url}
                </p>
                {statusBadge(audit.status)}
              </div>
              <p className="mt-0.5 text-sm text-neutral-500 truncate">{audit.website_url}</p>
              <p className="mt-0.5 text-xs text-neutral-400">{formatDate(audit.created_at)} · {audit.audit_type} audit</p>
            </div>

            {audit.grade && (
              <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg text-lg font-bold", scoreBg(audit.overall_score), scoreColor(audit.overall_score))}>
                {audit.grade}
              </div>
            )}

            {audit.status === "running" && (
              <div className="w-20">
                <div className="h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${audit.progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-xs text-neutral-400 mt-1 text-center">{audit.progress}%</p>
              </div>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteAudit(audit.id); }}
              className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-red-500 transition-colors"
            >
              <TrashIcon className="h-4 w-4" weight="regular" />
            </button>
          </div>
        ))}
      </div>
    );
  }

  function renderContentTab() {
    if (initialContent.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <SparkleIcon className="h-12 w-12 text-neutral-300 dark:text-neutral-600 mb-4" weight="regular" />
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">No generated content yet</h3>
          <p className="mt-1 text-sm text-neutral-500">Run an audit first, then generate email sequences, social calendars, and more.</p>
        </div>
      );
    }

    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {initialContent.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              {contentTypeBadge(item.content_type)}
              <span className="text-xs text-neutral-400">{formatDate(item.created_at)}</span>
            </div>
            <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{item.title}</p>
          </div>
        ))}
      </div>
    );
  }

  function renderReportsTab() {
    if (initialReports.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileTextIcon className="h-12 w-12 text-neutral-300 dark:text-neutral-600 mb-4" weight="regular" />
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">No reports yet</h3>
          <p className="mt-1 text-sm text-neutral-500">Generate reports from completed audits.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {initialReports.map((report) => (
          <div key={report.id} className="flex items-center gap-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <FileTextIcon className="h-8 w-8 text-indigo-500" weight="regular" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-neutral-900 dark:text-neutral-100">{report.title}</p>
              <p className="text-xs text-neutral-400">{formatDate(report.created_at)} · {report.report_type.toUpperCase()}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderActionsTab() {
    if (initialActions.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircleIcon className="h-12 w-12 text-neutral-300 dark:text-neutral-600 mb-4" weight="regular" />
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">No action items yet</h3>
          <p className="mt-1 text-sm text-neutral-500">Action items are generated from audit findings.</p>
        </div>
      );
    }

    const tiers = ["quick_win", "medium_term", "strategic"];
    const tierLabels: Record<string, string> = { quick_win: "Quick Wins", medium_term: "Medium Term", strategic: "Strategic" };

    return (
      <div className="space-y-6">
        {tiers.map((tier) => {
          const items = initialActions.filter((a) => a.tier === tier);
          if (items.length === 0) return null;
          return (
            <div key={tier}>
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-3">
                {tierLabels[tier]} ({items.length})
              </h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                      item.status === "completed"
                        ? "border-green-200 dark:border-green-800/30 bg-green-50/50 dark:bg-green-900/10"
                        : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900",
                    )}
                  >
                    <button
                      onClick={() => handleToggleAction(item.id, item.status)}
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                        item.status === "completed"
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-neutral-300 dark:border-neutral-600 hover:border-neutral-400",
                      )}
                    >
                      {item.status === "completed" && <CheckCircleIcon className="h-3 w-3" weight="bold" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm font-medium", item.status === "completed" ? "line-through text-neutral-400" : "text-neutral-900 dark:text-neutral-100")}>
                          {item.title}
                        </p>
                        {priorityBadge(item.priority)}
                      </div>
                      {item.description && (
                        <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2">{item.description}</p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs text-neutral-400">
                        {item.impact_estimate && <span>Impact: {item.impact_estimate}</span>}
                        {item.effort && <span>Effort: {item.effort}</span>}
                        {item.category && <span className="capitalize">{item.category}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderTabContent() {
    switch (activeTab) {
      case "audits": return renderAuditsTab();
      case "content": return renderContentTab();
      case "reports": return renderReportsTab();
      case "actions": return renderActionsTab();
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <PageHeader title="Marketing">
        <Button onClick={() => router.push("/dashboard/marketing/new")}>
          <PlusIcon className="h-4 w-4 mr-2" weight="bold" />
          New Audit
        </Button>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300",
            )}
          >
            <tab.icon className="h-4 w-4" weight="regular" />
            {tab.label}
            {tab.id === "audits" && initialAudits.length > 0 && (
              <span className="ml-1 rounded-full bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 text-xs">
                {initialAudits.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
}
