"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from "recharts";
import {
  Button,
  ArrowLeftIcon,
  SparkleIcon,
  FileTextIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  WarningIcon,
  MegaphoneSimpleIcon,
} from "@/components/ui";
import { Page, PageHeader, PageTabs, Section, DetailLayout } from "@/components/dashboard";
import { cn } from "@/lib/utils";
import { chartAccent, chartGrid, axisTick } from "@/lib/design-system/chart-colors";
import { updateMarketingActionItem } from "@/lib/actions/marketing";
import {
  aiGenerateEmailSequence,
  aiGenerateSocialCalendar,
  aiGenerateAdCampaign,
  aiGenerateClientProposal,
  aiGenerateMarketingReport,
} from "@/lib/actions/ai-marketing";

// ── Types ────────────────────────────────────────────────────────────────────

interface AuditData {
  id: string;
  website_url: string;
  business_name: string | null;
  business_type: string | null;
  audit_type: string;
  status: string;
  progress: number;
  overall_score: number | null;
  content_score: number | null;
  conversion_score: number | null;
  seo_score: number | null;
  competitive_score: number | null;
  brand_score: number | null;
  growth_score: number | null;
  grade: string | null;
  summary: string | null;
  result: Record<string, unknown> | null;
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
}

interface ContentItem {
  id: string;
  content_type: string;
  title: string;
  status: string;
  content: Record<string, unknown>;
  created_at: string;
}

interface ReportItem {
  id: string;
  report_type: string;
  title: string;
  content: string | null;
  created_at: string;
}

interface Props {
  audit: AuditData;
  actionItems: ActionItem[];
  content: ContentItem[];
  reports: ReportItem[];
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "findings", label: "Findings" },
  { id: "actions", label: "Actions" },
  { id: "content", label: "Generated Content" },
  { id: "generate", label: "Generate" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (!score) return "text-fg-muted";
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-accent-strong";
  if (score >= 55) return "text-warning";
  return "text-danger";
}

function severityColor(severity: string) {
  const map: Record<string, string> = {
    Critical: "bg-danger-surface text-danger",
    High: "bg-warning-surface text-warning",
    Medium: "bg-warning-surface text-warning",
    Low: "bg-accent-surface text-accent-on-surface",
  };
  return map[severity] || map.Medium;
}

// ── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ label, score, weight }: { label: string; score: number | null; weight: string }) {
  const s = score ?? 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-fg">{label}</span>
        <span className={cn("font-semibold", scoreColor(score))}>{score ?? "—"}/100 <span className="font-normal text-fg-muted text-xs">({weight})</span></span>
      </div>
      <div className="h-2 bg-active rounded-full overflow-hidden">
        <motion.div
          className={cn(
            "h-full rounded-full",
            s >= 85 ? "bg-success" : s >= 70 ? "bg-accent-strong" : s >= 55 ? "bg-warning" : s >= 40 ? "bg-warning" : "bg-danger",
          )}
          initial={{ width: 0 }}
          animate={{ width: `${s}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ── Large Score Gauge ────────────────────────────────────────────────────────

function LargeScoreGauge({ score, grade }: { score: number | null; grade: string | null }) {
  const s = score ?? 0;
  const size = 140;
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (s / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={6} className="text-fg-disabled" />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={6}
            strokeLinecap="round"
            className={scoreColor(score)}
            stroke="currentColor"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            strokeDasharray={circumference}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-xl font-semibold", scoreColor(score))}>{score ?? "—"}</span>
          {grade && <span className={cn("text-sm font-semibold", scoreColor(score))}>{grade}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function AuditDetailClient({ audit, actionItems, content, reports }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [isPending, startTransition] = useTransition();
  const [generating, setGenerating] = useState<string | null>(null);

  const result = audit.result as Record<string, unknown> | null;

  // Extract findings from all dimensions
  const allFindings: Array<{ severity: string; finding: string; evidence: string; recommendation: string; impact_estimate: string; category: string }> = [];
  if (result) {
    for (const dim of ["content", "conversion", "seo", "competitive", "brand", "growth"]) {
      const dimData = result[dim] as Record<string, unknown> | undefined;
      if (dimData?.findings && Array.isArray(dimData.findings)) {
        for (const f of dimData.findings) {
          const finding = f as Record<string, string>;
          allFindings.push({
            severity: finding.severity || "Medium",
            finding: finding.finding || "",
            evidence: finding.evidence || "",
            recommendation: finding.recommendation || "",
            impact_estimate: finding.impact_estimate || "",
            category: dim,
          });
        }
      }
    }
  }

  const handleGenerate = async (type: string) => {
    setGenerating(type);
    startTransition(async () => {
      let res: { data?: unknown; error?: string } = {};

      switch (type) {
        case "email":
          res = await aiGenerateEmailSequence({ websiteUrl: audit.website_url, sequenceType: "Welcome", auditId: audit.id });
          break;
        case "social":
          res = await aiGenerateSocialCalendar({ websiteUrl: audit.website_url, platforms: ["LinkedIn", "Twitter", "Instagram"], auditId: audit.id });
          break;
        case "ads":
          res = await aiGenerateAdCampaign({ websiteUrl: audit.website_url, platforms: ["Google Ads", "Meta"], auditId: audit.id });
          break;
        case "proposal":
          res = await aiGenerateClientProposal({ auditId: audit.id });
          break;
        case "report":
          res = await aiGenerateMarketingReport(audit.id);
          break;
      }

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`${type} generated successfully!`);
        router.refresh();
      }
      setGenerating(null);
    });
  };

  const handleToggleAction = (id: string, currentStatus: string) => {
    startTransition(async () => {
      await updateMarketingActionItem(id, {
        status: currentStatus === "completed" ? "pending" : "completed",
        completed_at: currentStatus === "completed" ? null : new Date().toISOString(),
      });
      router.refresh();
    });
  };

  // ── Radar chart data ─────────────────────────────────────────────────────

  const radarData = [
    { dimension: "Content", score: audit.content_score ?? 0 },
    { dimension: "Conversion", score: audit.conversion_score ?? 0 },
    { dimension: "SEO", score: audit.seo_score ?? 0 },
    { dimension: "Competitive", score: audit.competitive_score ?? 0 },
    { dimension: "Brand", score: audit.brand_score ?? 0 },
    { dimension: "Growth", score: audit.growth_score ?? 0 },
  ];

  // ── Tab renderers ────────────────────────────────────────────────────────

  function renderOverview() {
    return (
      <DetailLayout
        aside={
          <>
            {/* Score + Radar */}
            <div className="flex flex-col items-center px-6 py-5">
              <LargeScoreGauge score={audit.overall_score} grade={audit.grade} />
              <p className="mt-4 text-sm text-center text-fg-secondary">{audit.summary}</p>
            </div>

            <div className="px-6 py-5 border-t border-divider">
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke={chartGrid} />
                  <PolarAngleAxis dataKey="dimension" tick={axisTick} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Score" dataKey="score" stroke={chartAccent} fill={chartAccent} fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </>
        }
      >
        {/* Dimension Scores */}
        <Section title="Score Breakdown">
          <div className="space-y-4">
            <ScoreBar label="Content & Messaging" score={audit.content_score} weight="25%" />
            <ScoreBar label="Conversion Optimization" score={audit.conversion_score} weight="20%" />
            <ScoreBar label="SEO & Discoverability" score={audit.seo_score} weight="20%" />
            <ScoreBar label="Competitive Positioning" score={audit.competitive_score} weight="15%" />
            <ScoreBar label="Brand & Trust" score={audit.brand_score} weight="10%" />
            <ScoreBar label="Growth & Strategy" score={audit.growth_score} weight="10%" />
          </div>
        </Section>
      </DetailLayout>
    );
  }

  function renderFindings() {
    if (allFindings.length === 0) {
      return (
        <div className="text-center py-20 text-fg-muted">
          <WarningIcon className="h-12 w-12 mx-auto mb-4" weight="regular" />
          <p>No findings available. Run a full audit to see detailed findings.</p>
        </div>
      );
    }

    const sorted = [...allFindings].sort((a, b) => {
      const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return (order[a.severity as keyof typeof order] ?? 4) - (order[b.severity as keyof typeof order] ?? 4);
    });

    return (
      <div>
        {sorted.map((f, i) => (
          <div key={i} className="px-8 py-4 border-b border-divider max-sm:px-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", severityColor(f.severity))}>
                {f.severity}
              </span>
              <span className="text-xs text-fg-muted capitalize">{f.category}</span>
            </div>
            <p className="font-medium text-fg">{f.finding}</p>
            {f.evidence && <p className="mt-1 text-sm text-fg-secondary">{f.evidence}</p>}
            {f.recommendation && (
              <div className="mt-2 rounded-md bg-accent-surface p-3">
                <p className="text-sm text-accent-strong"><strong>Recommendation:</strong> {f.recommendation}</p>
                {f.impact_estimate && <p className="mt-1 text-xs text-accent-strong">Estimated impact: {f.impact_estimate}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderActions() {
    if (actionItems.length === 0) {
      return (
        <div className="text-center py-20 text-fg-muted">
          <CheckCircleIcon className="h-12 w-12 mx-auto mb-4" weight="regular" />
          <p>No action items yet.</p>
        </div>
      );
    }

    const tiers = ["quick_win", "medium_term", "strategic"];
    const tierLabels: Record<string, string> = { quick_win: "Quick Wins", medium_term: "Medium Term", strategic: "Strategic" };

    return (
      <div>
        {tiers.map((tier) => {
          const items = actionItems.filter((a) => a.tier === tier);
          if (items.length === 0) return null;
          return (
            <Section
              key={tier}
              title={
                <>
                  {tierLabels[tier]} ({items.length})
                </>
              }
            >
              <div className="divide-y divide-divider">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <button
                      onClick={() => handleToggleAction(item.id, item.status)}
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                        item.status === "completed"
                          ? "bg-success border-success text-on-inverse"
                          : "border-line",
                      )}
                    >
                      {item.status === "completed" && <CheckCircleIcon className="h-3 w-3" weight="bold" />}
                    </button>
                    <div className="flex-1">
                      <p className={cn("text-sm font-medium", item.status === "completed" && "line-through text-fg-muted")}>
                        {item.title}
                      </p>
                      {item.description && <p className="mt-0.5 text-xs text-fg-secondary">{item.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          );
        })}
      </div>
    );
  }

  function renderContent() {
    if (content.length === 0 && reports.length === 0) {
      return (
        <div className="text-center py-20 text-fg-muted">
          <SparkleIcon className="h-12 w-12 mx-auto mb-4" weight="regular" />
          <p>No generated content yet. Use the Generate tab to create content.</p>
        </div>
      );
    }

    return (
      <div>
        {reports.map((r) => (
          <div key={r.id} className="px-8 py-4 border-b border-divider max-sm:px-4">
            <div className="flex items-center gap-3">
              <FileTextIcon className="h-6 w-6 text-accent-strong" weight="regular" />
              <div>
                <p className="font-medium text-fg">{r.title}</p>
                <p className="text-xs text-fg-muted">{r.report_type.toUpperCase()} · {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            {r.content && (
              <details className="mt-3">
                <summary className="text-sm text-accent-strong cursor-pointer">View Report</summary>
                <div className="mt-2 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm text-fg-secondary max-h-96 overflow-y-auto rounded-lg bg-subtle p-4">
                  {r.content}
                </div>
              </details>
            )}
          </div>
        ))}
        {content.map((c) => (
          <div key={c.id} className="px-8 py-4 border-b border-divider max-sm:px-4">
            <div className="flex items-center gap-3">
              <SparkleIcon className="h-6 w-6 text-warning" weight="regular" />
              <div>
                <p className="font-medium text-fg">{c.title}</p>
                <p className="text-xs text-fg-muted">{c.content_type.replace(/_/g, " ")} · {new Date(c.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <details className="mt-3">
              <summary className="text-sm text-accent-strong cursor-pointer">View Content</summary>
              <pre className="mt-2 text-xs text-fg-secondary max-h-96 overflow-y-auto rounded-lg bg-subtle p-4 whitespace-pre-wrap">
                {JSON.stringify(c.content, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </div>
    );
  }

  function renderGenerate() {
    const generators = [
      { id: "email", label: "Email Sequence", description: "Generate a welcome/nurture email sequence", icon: EnvelopeIcon },
      { id: "social", label: "Social Calendar", description: "30-day social media content calendar", icon: SparkleIcon },
      { id: "ads", label: "Ad Campaign", description: "Google Ads & Meta ad copy", icon: SparkleIcon },
      { id: "proposal", label: "Client Proposal", description: "Agency proposal with pricing tiers", icon: FileTextIcon },
      { id: "report", label: "Marketing Report", description: "Comprehensive markdown report", icon: FileTextIcon },
    ];

    return (
      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {generators.map((gen) => (
            <button
              key={gen.id}
              onClick={() => handleGenerate(gen.id)}
              disabled={generating !== null}
              data-clay-box className={cn(
                "flex items-start gap-3 rounded-lg bg-subtle p-4 text-left shadow-card transition-colors hover:bg-muted",
                generating === gen.id && "bg-accent-surface",
              )}
            >
              <gen.icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-accent-strong" weight="regular" />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-fg">{gen.label}</p>
                <p className="mt-0.5 text-[13px] text-fg-muted">{gen.description}</p>
                {generating === gen.id && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-accent-strong">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <SparkleIcon className="h-4 w-4" weight="fill" />
                    </motion.div>
                    Generating...
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </Section>
    );
  }

  function renderTabContent() {
    switch (activeTab) {
      case "overview": return renderOverview();
      case "findings": return renderFindings();
      case "actions": return renderActions();
      case "content": return renderContent();
      case "generate": return renderGenerate();
    }
  }

  return (
    <Page>
      <PageHeader
        title={audit.business_name || audit.website_url}
        icon={<MegaphoneSimpleIcon size={18} />}
        description={
          /* URL + meta */
          <div className="flex flex-wrap items-center gap-x-2">
            <a href={audit.website_url} target="_blank" rel="noopener noreferrer" className="text-accent-strong hover:underline">
              {audit.website_url}
            </a>
            <span>·</span>
            <span className="capitalize">{audit.audit_type} audit</span>
            <span>·</span>
            <span>{new Date(audit.created_at).toLocaleDateString()}</span>
          </div>
        }
      >
        <Button variant="ghost" onClick={() => router.push("/dashboard/marketing")}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" weight="bold" />
          Back
        </Button>
      </PageHeader>

      {/* Tabs */}
      <PageTabs
        tabs={[...TABS]}
        value={activeTab}
        onChange={setActiveTab}
        className="max-sm:overflow-x-auto max-sm:overflow-y-hidden"
      />

      {renderTabContent()}
    </Page>
  );
}
