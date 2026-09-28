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
  if (!score) return "text-fg-muted";
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-accent-strong";
  if (score >= 55) return "text-warning";
  if (score >= 40) return "text-warning";
  return "text-danger";
}

function scoreBg(score: number | null): string {
  if (!score) return "bg-muted";
  if (score >= 85) return "bg-success-surface";
  if (score >= 70) return "bg-accent-surface";
  if (score >= 55) return "bg-warning-surface";
  if (score >= 40) return "bg-warning-surface";
  return "bg-danger-surface";
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-muted text-fg-secondary" },
    running: { label: "Running", className: "bg-accent-surface text-accent-on-surface" },
    completed: { label: "Completed", className: "bg-success-surface text-success" },
    failed: { label: "Failed", className: "bg-danger-surface text-danger" },
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
    critical: "bg-danger-surface text-danger",
    high: "bg-warning-surface text-warning",
    medium: "bg-warning-surface text-warning",
    low: "bg-accent-surface text-accent-on-surface",
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
    <span className="inline-flex items-center rounded-full bg-accent-surface text-accent-on-surface px-2 py-0.5 text-xs font-medium">
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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={4} className="text-fg-disabled" />
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
        <span className={cn("text-sm font-semibold", scoreColor(score))}>{score ?? "—"}</span>
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
          <ChartBarIcon className="h-12 w-12 text-fg-disabled mb-4" weight="regular" />
          <h3 className="text-lg font-medium text-fg">No marketing audits yet</h3>
          <p className="mt-1 text-sm text-fg-secondary">Run your first audit to analyze a website&apos;s marketing effectiveness.</p>
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
            className="flex items-center gap-4 rounded-lg border border-line bg-surface p-4 hover:border-fg-muted transition-colors cursor-pointer"
            onClick={() => router.push(`/dashboard/marketing/${audit.id}`)}
          >
            <ScoreGauge score={audit.overall_score} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-fg truncate">
                  {audit.business_name || audit.website_url}
                </p>
                {statusBadge(audit.status)}
              </div>
              <p className="mt-0.5 text-sm text-fg-secondary truncate">{audit.website_url}</p>
              <p className="mt-0.5 text-xs text-fg-muted">{formatDate(audit.created_at)} · {audit.audit_type} audit</p>
            </div>

            {audit.grade && (
              <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg text-lg font-semibold", scoreBg(audit.overall_score), scoreColor(audit.overall_score))}>
                {audit.grade}
              </div>
            )}

            {audit.status === "running" && (
              <div className="w-20">
                <div className="h-1.5 bg-active rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-accent-strong rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${audit.progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-xs text-fg-muted mt-1 text-center">{audit.progress}%</p>
              </div>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteAudit(audit.id); }}
              className="p-2 rounded hover:bg-muted text-fg-muted hover:text-danger transition-colors"
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
          <SparkleIcon className="h-12 w-12 text-fg-disabled mb-4" weight="regular" />
          <h3 className="text-lg font-medium text-fg">No generated content yet</h3>
          <p className="mt-1 text-sm text-fg-secondary">Run an audit first, then generate email sequences, social calendars, and more.</p>
        </div>
      );
    }

    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {initialContent.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-line bg-surface p-4 hover:border-fg-muted transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              {contentTypeBadge(item.content_type)}
              <span className="text-xs text-fg-muted">{formatDate(item.created_at)}</span>
            </div>
            <p className="font-medium text-fg truncate">{item.title}</p>
          </div>
        ))}
      </div>
    );
  }

  function renderReportsTab() {
    if (initialReports.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileTextIcon className="h-12 w-12 text-fg-disabled mb-4" weight="regular" />
          <h3 className="text-lg font-medium text-fg">No reports yet</h3>
          <p className="mt-1 text-sm text-fg-secondary">Generate reports from completed audits.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {initialReports.map((report) => (
          <div key={report.id} className="flex items-center gap-4 rounded-lg border border-line bg-surface p-4">
            <FileTextIcon className="h-8 w-8 text-accent-strong" weight="regular" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-fg">{report.title}</p>
              <p className="text-xs text-fg-muted">{formatDate(report.created_at)} · {report.report_type.toUpperCase()}</p>
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
          <CheckCircleIcon className="h-12 w-12 text-fg-disabled mb-4" weight="regular" />
          <h3 className="text-lg font-medium text-fg">No action items yet</h3>
          <p className="mt-1 text-sm text-fg-secondary">Action items are generated from audit findings.</p>
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
              <h3 className="text-sm font-semibold text-fg mb-3">
                {tierLabels[tier]} ({items.length})
              </h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                      item.status === "completed"
                        ? "border-success bg-success-surface"
                        : "border-line bg-surface",
                    )}
                  >
                    <button
                      onClick={() => handleToggleAction(item.id, item.status)}
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                        item.status === "completed"
                          ? "bg-success border-success text-on-inverse"
                          : "border-line hover:border-fg-muted",
                      )}
                    >
                      {item.status === "completed" && <CheckCircleIcon className="h-3 w-3" weight="bold" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm font-medium", item.status === "completed" ? "line-through text-fg-muted" : "text-fg")}>
                          {item.title}
                        </p>
                        {priorityBadge(item.priority)}
                      </div>
                      {item.description && (
                        <p className="mt-0.5 text-xs text-fg-secondary line-clamp-2">{item.description}</p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs text-fg-muted">
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
    <div className="flex flex-col gap-6 p-6 lg:p-6">
      <PageHeader title="Marketing">
        <Button onClick={() => router.push("/dashboard/marketing/new")}>
          <PlusIcon className="h-4 w-4 mr-2" weight="bold" />
          New Audit
        </Button>
      </PageHeader>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded border border-line bg-subtle p-1 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap",
                isActive
                  ? "bg-surface text-fg"
                  : "text-fg-secondary hover:text-fg",
              )}
            >
              <tab.icon className="h-4 w-4" weight="regular" />
              {tab.label}
              {tab.id === "audits" && initialAudits.length > 0 && (
                <span className="ml-1 rounded-full bg-active px-1.5 py-0.5 text-xs">
                  {initialAudits.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
}
