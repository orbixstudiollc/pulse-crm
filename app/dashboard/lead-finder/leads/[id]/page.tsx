"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  SparkleIcon,
  EnvelopeIcon,
  PhoneIcon,
  GlobeIcon,
  CircleNotchIcon,
  CheckCircleIcon,
  XCircleIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CaretDownIcon,
  CaretRightIcon,
  LightningIcon,
  TargetIcon,
  ChartBarIcon,
} from "@/components/ui";
import { ScoreBadge } from "@/components/lead-finder/ScoreBadge";

// ── Types ──────────────────────────────────────────────────────────────────

interface Personalization {
  summary?: string;
  tech_stack?: string[];
  pain_points?: string[];
  personalization_summary?: string;
  campaign_kpis?: Record<string, boolean | string>;
  enrichment_actors?: string[];
  [key: string]: unknown;
}

interface Lead {
  id: string;
  campaign_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  score: number;
  status: string;
  source: string;
  raw_data: Record<string, unknown> | null;
  mapped_data: Record<string, unknown> | null;
  llm_cost_usd: number;
  created_at: string;
  updated_at: string;
  personalization: Personalization | null;
}

// ── Status styles ──────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  new: "text-blue-700 dark:text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30",
  enriching: "text-amber-700 dark:text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30",
  enriched: "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30",
  qualified: "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30",
  disqualified: "text-red-700 dark:text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30",
  converted: "text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30",
  error: "text-red-700 dark:text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30",
};

// ── Collapsible section ────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <span className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">{title}</span>
        {open ? (
          <CaretDownIcon size={14} className="text-neutral-500 dark:text-neutral-400" />
        ) : (
          <CaretRightIcon size={14} className="text-neutral-500 dark:text-neutral-400" />
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ── Key-value row ──────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ size: number; className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon size={14} className="text-neutral-500 dark:text-neutral-400 mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
        <div className="text-sm text-neutral-950 dark:text-neutral-50 break-all">{value || "--"}</div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [importing, setImporting] = useState(false);

  // ── Fetch lead ─────────────────────────────────────────────────────────

  const fetchLead = useCallback(async () => {
    try {
      const res = await fetch(`/api/lead-finder/leads/${id}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setLead(json.data);
    } catch {
      toast.error("Failed to load lead");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  // ── Actions ────────────────────────────────────────────────────────────

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const res = await fetch(`/api/lead-finder/leads/${id}/enrich`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Enrichment started");
      setTimeout(fetchLead, 3000);
    } catch {
      toast.error("Failed to enrich lead");
    } finally {
      setEnriching(false);
    }
  };

  const handleImportToCRM = async () => {
    setImporting(true);
    try {
      const res = await fetch("/api/lead-finder/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", leadIds: [id] }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Lead imported to CRM");
    } catch {
      toast.error("Failed to import lead");
    } finally {
      setImporting(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      const res = await fetch(`/api/lead-finder/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      setLead((prev) => (prev ? { ...prev, status } : null));
      toast.success(`Lead marked as ${status}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  // ── Loading / Error ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <CircleNotchIcon size={32} className="animate-spin text-neutral-500 dark:text-neutral-400" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center">
        <p className="text-neutral-500 dark:text-neutral-400 mb-4">Lead not found</p>
        <Link
          href="/dashboard/lead-finder/leads"
          className="text-white text-sm underline"
        >
          Back to leads
        </Link>
      </div>
    );
  }

  const personalization = lead.personalization;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
          >
            <ArrowLeftIcon size={16} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-neutral-950 dark:text-neutral-50">
                {lead.display_name || "Unknown Lead"}
              </h1>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[lead.status] || "text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800"}`}
              >
                {lead.status}
              </span>
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              Source: {lead.source?.replace(/_/g, " ") || "Unknown"} | Created:{" "}
              {new Date(lead.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <select
            value={lead.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-950 dark:text-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-950 dark:focus:ring-white"
          >
            <option value="new">New</option>
            <option value="enriched">Enriched</option>
            <option value="qualified">Qualified</option>
            <option value="disqualified">Disqualified</option>
            <option value="converted">Converted</option>
          </select>
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-50 transition-colors"
          >
            {enriching ? (
              <CircleNotchIcon size={14} className="animate-spin" />
            ) : (
              <SparkleIcon size={14} />
            )}
            Enrich
          </button>
          <button
            onClick={handleImportToCRM}
            disabled={importing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50 transition-colors"
          >
            {importing ? (
              <CircleNotchIcon size={14} className="animate-spin" />
            ) : (
              <ArrowRightIcon size={14} />
            )}
            Import to CRM
          </button>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Contact info */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 mb-4">Contact Information</h3>
            <div className="space-y-1 divide-y divide-[#232329]/50">
              <InfoRow icon={EnvelopeIcon} label="Email" value={lead.email} />
              <InfoRow icon={PhoneIcon} label="Phone" value={lead.phone} />
              <InfoRow
                icon={GlobeIcon}
                label="Website"
                value={
                  lead.website ? (
                    <a
                      href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {lead.website}
                    </a>
                  ) : null
                }
              />
            </div>

            {/* Score */}
            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Lead Score</span>
                <ScoreBadge score={lead.score} />
              </div>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 mb-4 flex items-center gap-2">
              <CurrencyDollarIcon size={14} className="text-neutral-500 dark:text-neutral-400" />
              Cost Breakdown
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">LLM Cost</span>
                <span className="text-sm text-neutral-950 dark:text-neutral-50 font-medium">
                  ${lead.llm_cost_usd?.toFixed(4) || "0.0000"}
                </span>
              </div>
            </div>
          </div>

          {/* Mapped data table */}
          <CollapsibleSection title="Mapped Data" defaultOpen={true}>
            {lead.mapped_data && Object.keys(lead.mapped_data).length > 0 ? (
              <div className="space-y-1">
                {Object.entries(lead.mapped_data).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start justify-between py-1.5 border-b border-neutral-200 dark:border-neutral-800/30 last:border-0"
                  >
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-neutral-950 dark:text-neutral-50 text-right max-w-[60%] break-all">
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">No mapped data available.</p>
            )}
          </CollapsibleSection>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Personalization data */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 mb-4 flex items-center gap-2">
              <SparkleIcon size={14} className="text-neutral-500 dark:text-neutral-400" />
              Personalization Data
            </h3>

            {personalization ? (
              <div className="space-y-4">
                {/* Summary */}
                {(personalization.summary || personalization.personalization_summary) && (
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Summary</p>
                    <p className="text-sm text-neutral-950 dark:text-neutral-50 leading-relaxed">
                      {personalization.summary || personalization.personalization_summary}
                    </p>
                  </div>
                )}

                {/* Tech stack */}
                {personalization.tech_stack && personalization.tech_stack.length > 0 && (
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Tech Stack</p>
                    <div className="flex flex-wrap gap-1.5">
                      {personalization.tech_stack.map((tech, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-blue-400/10 text-blue-600 dark:text-blue-400 text-xs"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pain points */}
                {personalization.pain_points && personalization.pain_points.length > 0 && (
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Pain Points</p>
                    <ul className="space-y-1">
                      {personalization.pain_points.map((point, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-neutral-950 dark:text-neutral-50"
                        >
                          <span className="text-red-600 dark:text-red-400 mt-0.5">-</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Enrichment actors */}
                {personalization.enrichment_actors &&
                  personalization.enrichment_actors.length > 0 && (
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                        Enrichment Actors Used
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {personalization.enrichment_actors.map((actor, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-xs"
                          >
                            <LightningIcon size={10} />
                            {actor}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                No personalization data yet. Enrich this lead to generate
                personalization insights.
              </p>
            )}
          </div>

          {/* KPI values table */}
          {personalization?.campaign_kpis &&
            Object.keys(personalization.campaign_kpis).length > 0 && (
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 mb-4 flex items-center gap-2">
                  <ChartBarIcon size={14} className="text-neutral-500 dark:text-neutral-400" />
                  KPI Values
                </h3>
                <div className="space-y-1">
                  {Object.entries(personalization.campaign_kpis).map(
                    ([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-800/30 last:border-0"
                      >
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">
                          {key.replace(/_/g, " ")}
                        </span>
                        {typeof value === "boolean" ? (
                          value ? (
                            <CheckCircleIcon
                              size={16}
                              className="text-green-700 dark:text-green-400"
                            />
                          ) : (
                            <XCircleIcon size={16} className="text-red-600 dark:text-red-400" />
                          )
                        ) : (
                          <span className="text-xs text-neutral-950 dark:text-neutral-50">
                            {String(value)}
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

          {/* Raw data accordion */}
          <CollapsibleSection title="Raw Data (JSON)">
            {lead.raw_data ? (
              <pre className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-950 p-3 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap break-all">
                {JSON.stringify(lead.raw_data, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">No raw data available.</p>
            )}
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}
