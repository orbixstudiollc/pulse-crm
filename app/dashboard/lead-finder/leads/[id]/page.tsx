"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  CaretDownIcon,
  CaretRightIcon,
  LightningIcon,
  ChartBarIcon,
  PencilSimpleIcon,
  CheckIcon,
  XIcon,
  CopyIcon,
  ArrowSquareOutIcon,
  HashIcon,
  LinkIcon,
  TagIcon,
  FloppyDiskIcon,
  ArrowPathIcon,
  ChevronsRightIcon,
  Input,
  Button,
} from "@/components/ui";
import { LeadFinderSubNav } from "@/components/lead-finder/SubNav";
import { ScoreBadge } from "@/components/lead-finder/ScoreBadge";
import { useLeadEvents } from "@/hooks/use-lead-events";

// ── Types ──────────────────────────────────────────────────────────────────

interface KpiDefinition {
  id: string;
  label: string;
  type: "boolean" | "text";
  description?: string;
}

interface LeadFieldDefinition {
  id: string;
  label: string;
  type: "text" | "number" | "boolean" | "url";
  description?: string;
}

interface Personalization {
  personalizationSummary?: string;
  personalization_summary?: string;
  summary?: string;
  painPoints?: string[];
  pain_points?: string[];
  websiteTechStack?: string[];
  tech_stack?: string[];
  hasChatbot?: boolean;
  hasBookingSystem?: boolean;
  companyDescription?: string;
  lastBlogPost?: string;
  campaignKpis?: Record<string, boolean | string>;
  campaign_kpis?: Record<string, boolean | string>;
  rawEnrichmentData?: Record<string, unknown>;
  enrichment_actors?: string[];
  [key: string]: unknown;
}

interface LeadDetail {
  id: number | string;
  campaignId?: number | string | null;
  campaign_id?: string | null;
  displayName?: string | null;
  display_name?: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  score: number;
  status: string;
  source: string;
  createdAt?: string;
  created_at?: string;
  rawData?: Record<string, unknown> | null;
  raw_data?: Record<string, unknown> | null;
  mappedData?: Record<string, unknown> | null;
  mapped_data?: Record<string, unknown> | null;
  llmCostUsd?: number;
  llm_cost_usd?: number;
  apifyCostUsd?: number;
  apify_cost_usd?: number;
  discoveryLlmCostUsd?: number;
  discovery_llm_cost_usd?: number;
  discoveryApifyCostUsd?: number;
  discovery_apify_cost_usd?: number;
  kpiDefinitions?: KpiDefinition[];
  leadFieldDefinitions?: LeadFieldDefinition[];
  enrichActorIds?: string[];
  personalization: Personalization | null;
}

// ── Helpers to normalize camelCase / snake_case ───────────────────────────

function n(lead: LeadDetail) {
  return {
    id: lead.id,
    displayName: lead.displayName ?? lead.display_name ?? null,
    email: lead.email,
    phone: lead.phone,
    website: lead.website,
    score: lead.score,
    status: lead.status,
    source: lead.source,
    createdAt: lead.createdAt ?? lead.created_at ?? "",
    rawData: lead.rawData ?? lead.raw_data ?? null,
    mappedData: lead.mappedData ?? lead.mapped_data ?? null,
    llmCostUsd: lead.llmCostUsd ?? lead.llm_cost_usd ?? 0,
    apifyCostUsd: lead.apifyCostUsd ?? lead.apify_cost_usd ?? 0,
    discoveryLlmCostUsd: lead.discoveryLlmCostUsd ?? lead.discovery_llm_cost_usd ?? 0,
    discoveryApifyCostUsd: lead.discoveryApifyCostUsd ?? lead.discovery_apify_cost_usd ?? 0,
    kpiDefinitions: lead.kpiDefinitions ?? [],
    leadFieldDefinitions: lead.leadFieldDefinitions ?? [],
    enrichActorIds: lead.enrichActorIds ?? [],
    personalization: lead.personalization,
  };
}

function getPersonalizationSummary(p: Personalization | null) {
  return p?.personalizationSummary ?? p?.personalization_summary ?? p?.summary ?? null;
}
function getPainPoints(p: Personalization | null) {
  return p?.painPoints ?? p?.pain_points ?? [];
}
function getTechStack(p: Personalization | null) {
  return p?.websiteTechStack ?? p?.tech_stack ?? [];
}
function getCampaignKpis(p: Personalization | null) {
  return p?.campaignKpis ?? p?.campaign_kpis ?? {};
}

// ── Status styles ──────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  new: "text-blue-400 bg-blue-400/10",
  enriching: "text-amber-400 bg-amber-400/10",
  enriched: "text-green-400 bg-green-400/10",
  qualified: "text-green-400 bg-green-400/10",
  converted: "text-violet-400 bg-violet-400/10",
  disqualified: "text-red-400 bg-red-400/10",
  declined: "text-red-400 bg-red-400/10",
  archived: "text-neutral-400 bg-neutral-400/10",
  error: "text-red-400 bg-red-400/10",
};

const ALL_STATUSES = ["new", "enriching", "enriched", "qualified", "converted", "disqualified", "declined", "archived"];

// ── Collapsible section ────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  action,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ size: number; className?: string }>;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-neutral-50">
          {Icon && <Icon size={14} className="text-neutral-400" />}
          {title}
        </span>
        <div className="flex items-center gap-2">
          {action && open && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
          {open ? (
            <CaretDownIcon size={14} className="text-neutral-400" />
          ) : (
            <CaretRightIcon size={14} className="text-neutral-400" />
          )}
        </div>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ── InfoRow (read-only) ───────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
  link,
}: {
  icon?: React.ComponentType<{ size: number; className?: string }>;
  label: string;
  value?: string | null | React.ReactNode;
  link?: boolean;
}) {
  const strVal = typeof value === "string" ? value : null;
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon size={14} className="text-neutral-400 mt-0.5 shrink-0" />}
      <span className="text-xs text-neutral-400 w-28 shrink-0 mt-0.5">{label}</span>
      {value ? (
        link && strVal ? (
          <a
            href={strVal.startsWith("http") ? strVal : `https://${strVal}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:underline min-w-0 break-all"
          >
            {strVal}
          </a>
        ) : (
          <span className="text-sm text-neutral-50 min-w-0 break-all">{value}</span>
        )
      ) : (
        <span className="text-sm text-neutral-500 italic">Not set</span>
      )}
    </div>
  );
}

// ── EditableRow ───────────────────────────────────────────────────────────

function EditableRow({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon?: React.ComponentType<{ size: number; className?: string }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      {Icon && <Icon size={14} className="text-neutral-400 mt-2.5 shrink-0" />}
      <span className="text-xs text-neutral-400 w-28 shrink-0 mt-2">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  );
}

// ── RawDataBlock ──────────────────────────────────────────────────────────

function RawDataBlock({
  title,
  data,
  onExpand,
}: {
  title: string;
  data: unknown;
  onExpand: (v: { title: string; data: unknown }) => void;
}) {
  const json = JSON.stringify(data, null, 2);
  const copyToClipboard = () => {
    navigator.clipboard.writeText(json).then(() => toast.success("Copied to clipboard"));
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-neutral-400">{title}</p>
        <div className="flex gap-1">
          <button onClick={copyToClipboard} className="rounded p-1 text-neutral-400 hover:bg-neutral-800 transition-colors" title="Copy JSON">
            <CopyIcon size={14} />
          </button>
          <button onClick={() => onExpand({ title, data })} className="rounded p-1 text-neutral-400 hover:bg-neutral-800 transition-colors" title="Expand">
            <ArrowSquareOutIcon size={14} />
          </button>
        </div>
      </div>
      <pre className="max-h-64 overflow-auto rounded-lg bg-neutral-950 border border-neutral-800 p-3 text-xs text-neutral-300">
        {json}
      </pre>
    </div>
  );
}

// ── JSON viewer modal ─────────────────────────────────────────────────────

function JsonModal({
  dialog,
  onClose,
}: {
  dialog: { title: string; data: unknown } | null;
  onClose: () => void;
}) {
  if (!dialog) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h3 className="text-sm font-semibold text-neutral-50">{dialog.title}</h3>
          <button onClick={onClose} className="p-1 rounded text-neutral-400 hover:bg-neutral-800 transition-colors">
            <XIcon size={16} />
          </button>
        </div>
        <pre className="overflow-auto p-5 text-xs text-neutral-300 flex-1">
          {JSON.stringify(dialog.data, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [jsonDialog, setJsonDialog] = useState<{ title: string; data: unknown } | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [actorMenuOpen, setActorMenuOpen] = useState(false);

  // KPI editing
  const [kpiValues, setKpiValues] = useState<Record<string, boolean | string>>({});
  const [kpiDirty, setKpiDirty] = useState(false);
  const [savingKpis, setSavingKpis] = useState(false);

  // Contact inline editing
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editContactValues, setEditContactValues] = useState<Record<string, string>>({});
  const [savingContact, setSavingContact] = useState(false);

  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const actorMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setStatusMenuOpen(false);
      if (actorMenuRef.current && !actorMenuRef.current.contains(e.target as Node)) setActorMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Fetch lead ─────────────────────────────────────────────────────────

  const loadNow = useCallback(async () => {
    try {
      const res = await fetch(`/api/lead-finder/leads/${id}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      const data: LeadDetail = json.data ?? json;
      setLead(data);
      const rawKpis = getCampaignKpis(data.personalization);
      setKpiValues(typeof rawKpis === "string" ? JSON.parse(rawKpis as string) : rawKpis || {});
      setKpiDirty(false);
    } catch {
      toast.error("Failed to load lead");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const load = useCallback(() => {
    if (loadTimer.current) clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(loadNow, 300);
  }, [loadNow]);

  useEffect(() => {
    loadNow();
  }, [loadNow]);

  const isEnrichingFromServer = lead?.status === "enriching";
  const isEnrichingState = enriching || !!isEnrichingFromServer;

  // ── Real-time events ──────────────────────────────────────────────────

  useLeadEvents({
    onLeadKpiUpdated: (data) => {
      if (!kpiDirty && data.campaignKpis) {
        setKpiValues(data.campaignKpis as Record<string, boolean | string>);
      }
    },
    onLeadEnrichmentCompleted: () => load(),
    onLeadStatusChanged: () => load(),
  });

  // ── Actions ───────────────────────────────────────────────────────────

  const handleEnrich = async (actorIds?: string[]) => {
    setEnriching(true);
    try {
      const res = await fetch(`/api/lead-finder/leads/${id}/enrich`, {
        method: "POST",
        ...(actorIds
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorIds }) }
          : {}),
      });
      if (!res.ok) throw new Error("Enrichment failed");
      toast.success(actorIds ? "Actor enrichment started" : "Enrichment started");
      load();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setEnriching(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    setStatusMenuOpen(false);
    try {
      const res = await fetch(`/api/lead-finder/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      setLead((prev) => (prev ? { ...prev, status } : null));
      toast.success(`Status updated to ${status}`);
    } catch {
      toast.error("Failed to update status");
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

  // ── KPI editing ───────────────────────────────────────────────────────

  const updateKpiValue = (kpiId: string, value: boolean | string) => {
    setKpiValues((prev) => ({ ...prev, [kpiId]: value }));
    setKpiDirty(true);
  };

  const saveKpis = async () => {
    setSavingKpis(true);
    try {
      await fetch(`/api/lead-finder/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignKpis: kpiValues }),
      });
      toast.success("KPIs saved");
      setKpiDirty(false);
    } catch {
      toast.error("Failed to save KPIs");
    } finally {
      setSavingKpis(false);
    }
  };

  // ── Contact inline editing ────────────────────────────────────────────

  const startEditingContact = () => {
    if (!lead) return;
    const ld = n(lead);
    const mapped = ld.mappedData as Record<string, unknown> | undefined;
    const raw = ld.rawData as Record<string, unknown> | undefined;
    const values: Record<string, string> = {
      email: lead.email || "",
      phone: lead.phone || "",
      website: lead.website || "",
    };
    for (const field of ld.leadFieldDefinitions) {
      const val = mapped?.[field.id] ?? raw?.[field.id];
      values[`field:${field.id}`] = val != null ? String(val) : "";
    }
    setEditContactValues(values);
    setIsEditingContact(true);
  };

  const discardContactEdit = () => {
    setIsEditingContact(false);
    setEditContactValues({});
  };

  const saveContactEdit = async () => {
    if (!lead) return;
    const ld = n(lead);
    setSavingContact(true);
    try {
      const body: Record<string, unknown> = {};
      if (editContactValues.email !== (lead.email || "")) body.email = editContactValues.email || null;
      if (editContactValues.phone !== (lead.phone || "")) body.phone = editContactValues.phone || null;
      if (editContactValues.website !== (lead.website || "")) body.website = editContactValues.website || null;

      const mapped = (ld.mappedData as Record<string, unknown>) || {};
      const updatedMapped = { ...mapped };
      let mappedChanged = false;
      for (const field of ld.leadFieldDefinitions) {
        const key = `field:${field.id}`;
        const oldVal = mapped[field.id] != null ? String(mapped[field.id]) : "";
        if (editContactValues[key] !== oldVal) {
          updatedMapped[field.id] = editContactValues[key] || null;
          mappedChanged = true;
        }
      }
      if (mappedChanged) body.mappedData = JSON.stringify(updatedMapped);

      if (Object.keys(body).length > 0) {
        const res = await fetch(`/api/lead-finder/leads/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed to save");
        toast.success("Contact info updated");
        load();
      }
      setIsEditingContact(false);
      setEditContactValues({});
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSavingContact(false);
    }
  };

  // ── Loading / Error ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <LeadFinderSubNav />
        <div className="flex items-center justify-center h-64">
          <CircleNotchIcon size={32} className="animate-spin text-neutral-400" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6 lg:p-8">
        <LeadFinderSubNav />
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-neutral-400 mb-4">Lead not found</p>
          <Link href="/dashboard/lead-finder/leads" className="text-sm text-blue-400 hover:underline">
            Back to leads
          </Link>
        </div>
      </div>
    );
  }

  const ld = n(lead);
  const p = lead.personalization;
  const painPoints = getPainPoints(p);
  const techStack = getTechStack(p);
  const persSum = getPersonalizationSummary(p);
  const campaignKpis = getCampaignKpis(p);

  // Format dynamic field values
  const formatVal = (val: unknown, type: string): string => {
    if (val == null) return "";
    if (type === "boolean") return val === true || val === "true" ? "Yes" : val === false || val === "false" ? "No" : String(val);
    if (type === "number" && typeof val === "number") return val.toLocaleString();
    if (typeof val === "object") {
      if (Array.isArray(val)) {
        if (val.length === 0) return "";
        if (val.every((v) => typeof v !== "object" || v === null)) return val.filter((v) => v != null).join(", ");
        return val.map((item) => {
          if (typeof item !== "object" || item === null) return String(item);
          return Object.values(item as Record<string, unknown>).filter((v) => v != null).map(String).join(": ");
        }).join(", ");
      }
      const entries = Object.entries(val as Record<string, unknown>).filter(([, v]) => v != null);
      if (entries.length === 0) return "";
      return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
    }
    return String(val);
  };

  // Cost breakdown
  const discoveryLlm = ld.discoveryLlmCostUsd;
  const discoveryApify = ld.discoveryApifyCostUsd;
  const totalLlm = ld.llmCostUsd;
  const totalApify = ld.apifyCostUsd;
  const enrichmentLlm = totalLlm - discoveryLlm;
  const enrichmentApify = totalApify - discoveryApify;
  const discoveryCost = discoveryLlm + discoveryApify;
  const enrichmentCost = enrichmentLlm + enrichmentApify;
  const totalCost = totalLlm + totalApify;
  const isEnrichedStatus = lead.status !== "new" && lead.status !== "enriching";

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8">
      <LeadFinderSubNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-50 transition-colors"
          >
            <ArrowLeftIcon size={16} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-neutral-50">
                {ld.displayName || "Unknown Lead"}
              </h1>
              <ScoreBadge score={ld.score} />
            </div>
            <p className="text-sm text-neutral-400 mt-0.5">
              Source: {ld.source?.replace(/_/g, " ") || "Unknown"} | Created:{" "}
              {ld.createdAt ? new Date(ld.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "--"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status dropdown */}
          <div className="relative" ref={statusMenuRef}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setStatusMenuOpen(!statusMenuOpen)}
              rightIcon={<CaretDownIcon size={12} />}
              className={`rounded-full capitalize ${STATUS_STYLES[lead.status] || "text-neutral-400 bg-neutral-800"}`}
            >
              {lead.status}
            </Button>
            {statusMenuOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-neutral-900 border border-neutral-800 rounded-lg shadow-lg z-30 py-1">
                {ALL_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    disabled={s === lead.status}
                    className="w-full text-left px-3 py-2 text-sm capitalize hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-default transition-colors flex items-center gap-2"
                  >
                    <span className={`inline-block w-2 h-2 rounded-full ${STATUS_STYLES[s]?.split(" ")[0]?.replace("text-", "bg-") || "bg-neutral-500"}`} />
                    <span className="text-neutral-50">{s}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Enrich button(s) */}
          {lead.status === "new" || lead.status === "enriching" ? (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleEnrich()}
                disabled={isEnrichingState}
                leftIcon={isEnrichingState ? <CircleNotchIcon size={14} className="animate-spin" /> : <LightningIcon size={14} />}
              >
                {isEnrichingState ? "Enriching..." : "Enrich Lead"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange("qualified")}
                disabled={isEnrichingState}
                leftIcon={<ChevronsRightIcon size={14} />}
              >
                Skip Enrichment
              </Button>
            </>
          ) : (
            <div className="flex gap-1">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleEnrich()}
                disabled={isEnrichingState}
                leftIcon={<ArrowPathIcon size={14} className={isEnrichingState ? "animate-spin" : ""} />}
              >
                {isEnrichingState ? "Re-enriching..." : "Re-enrich"}
              </Button>
              {ld.enrichActorIds.length > 1 && (
                <div className="relative" ref={actorMenuRef}>
                  <button
                    onClick={() => setActorMenuOpen(!actorMenuOpen)}
                    disabled={isEnrichingState}
                    className="inline-flex items-center p-2 rounded-lg bg-neutral-800 text-neutral-50 hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                  >
                    <CaretDownIcon size={14} />
                  </button>
                  {actorMenuOpen && (
                    <div className="absolute right-0 mt-1 w-56 bg-neutral-900 border border-neutral-800 rounded-lg shadow-lg z-30 py-1">
                      <button
                        onClick={() => { setActorMenuOpen(false); handleEnrich(); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-800 transition-colors flex items-center gap-2 text-neutral-50"
                      >
                        <ArrowPathIcon size={14} className="text-neutral-400" />
                        All actors
                      </button>
                      <div className="border-t border-neutral-800 my-1" />
                      {ld.enrichActorIds.map((actorId) => (
                        <button
                          key={actorId}
                          onClick={() => { setActorMenuOpen(false); handleEnrich([actorId]); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-800 transition-colors flex items-center gap-2 text-neutral-50"
                        >
                          <LightningIcon size={14} className="text-neutral-400" />
                          {actorId}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Import to CRM */}
          <Button
            variant="primary"
            size="sm"
            onClick={handleImportToCRM}
            disabled={importing}
            leftIcon={importing ? <CircleNotchIcon size={14} className="animate-spin" /> : <ArrowRightIcon size={14} />}
          >
            Import to CRM
          </Button>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-50">Contact Information</h3>
              {isEditingContact ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={discardContactEdit}
                    disabled={savingContact}
                    leftIcon={<XIcon size={12} />}
                  >
                    Discard
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={saveContactEdit}
                    disabled={savingContact}
                    leftIcon={savingContact ? <CircleNotchIcon size={12} className="animate-spin" /> : <CheckIcon size={12} />}
                  >
                    Save
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startEditingContact}
                  leftIcon={<PencilSimpleIcon size={12} />}
                >
                  Edit
                </Button>
              )}
            </div>

            <div className="space-y-0 divide-y divide-neutral-800/50">
              {isEditingContact ? (
                <>
                  <EditableRow icon={EnvelopeIcon} label="Email" value={editContactValues.email || ""} onChange={(v) => setEditContactValues({ ...editContactValues, email: v })} placeholder="email@example.com" />
                  <EditableRow icon={PhoneIcon} label="Phone" value={editContactValues.phone || ""} onChange={(v) => setEditContactValues({ ...editContactValues, phone: v })} placeholder="+1 (555) 000-0000" />
                  <EditableRow icon={GlobeIcon} label="Website" value={editContactValues.website || ""} onChange={(v) => setEditContactValues({ ...editContactValues, website: v })} placeholder="https://example.com" />
                  {ld.leadFieldDefinitions.map((field) => {
                    const FieldIcon = field.type === "number" ? HashIcon : field.type === "url" ? LinkIcon : TagIcon;
                    return (
                      <EditableRow
                        key={field.id}
                        icon={FieldIcon}
                        label={field.label}
                        value={editContactValues[`field:${field.id}`] || ""}
                        onChange={(v) => setEditContactValues({ ...editContactValues, [`field:${field.id}`]: v })}
                        placeholder={field.description || field.label}
                      />
                    );
                  })}
                </>
              ) : (
                <>
                  <InfoRow icon={EnvelopeIcon} label="Email" value={lead.email} />
                  <InfoRow icon={PhoneIcon} label="Phone" value={lead.phone} />
                  <InfoRow icon={GlobeIcon} label="Website" value={lead.website} link />
                  {ld.leadFieldDefinitions.length > 0 && (() => {
                    const mapped = ld.mappedData as Record<string, unknown> | undefined;
                    const raw = ld.rawData as Record<string, unknown> | undefined;
                    return ld.leadFieldDefinitions.map((field) => {
                      const val = mapped?.[field.id] ?? raw?.[field.id];
                      const strVal = val != null ? formatVal(val, field.type) : "";
                      const isUrl = field.type === "url" || (typeof strVal === "string" && strVal.startsWith("http"));
                      const FieldIcon = field.type === "number" ? HashIcon : isUrl ? LinkIcon : TagIcon;
                      return <InfoRow key={field.id} icon={FieldIcon} label={field.label} value={strVal || undefined} link={isUrl} />;
                    });
                  })()}
                </>
              )}
            </div>

            {/* Score in contact card */}
            <div className="mt-4 pt-4 border-t border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">Lead Score</span>
                <ScoreBadge score={ld.score} />
              </div>
            </div>
          </div>

          {/* Personalization Insights */}
          {p && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-neutral-50 mb-4 flex items-center gap-2">
                <SparkleIcon size={14} className="text-neutral-400" />
                Personalization Insights
              </h3>
              <div className="space-y-4">
                {persSum && (
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">Summary</p>
                    <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">{persSum}</p>
                  </div>
                )}
                {p.companyDescription && (
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">About</p>
                    <p className="text-sm text-neutral-200">{p.companyDescription}</p>
                  </div>
                )}
                {painPoints.length > 0 && (
                  <div>
                    <p className="text-xs text-neutral-400 mb-2">Pain Points</p>
                    <div className="flex flex-wrap gap-1.5">
                      {painPoints.map((pp, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-red-400/10 text-red-400 text-xs">{pp}</span>
                      ))}
                    </div>
                  </div>
                )}
                {techStack.length > 0 && (
                  <div>
                    <p className="text-xs text-neutral-400 mb-2">Tech Stack</p>
                    <div className="flex flex-wrap gap-1.5">
                      {techStack.map((t, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-blue-400/10 text-blue-400 text-xs">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(p.hasChatbot || p.hasBookingSystem) && (
                  <div>
                    <p className="text-xs text-neutral-400 mb-2">Detections</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.hasChatbot && (
                        <span className="px-2 py-0.5 rounded-md bg-violet-400/10 text-violet-400 text-xs">Chatbot Detected</span>
                      )}
                      {p.hasBookingSystem && (
                        <span className="px-2 py-0.5 rounded-md bg-violet-400/10 text-violet-400 text-xs">Booking System Detected</span>
                      )}
                    </div>
                  </div>
                )}
                {p.lastBlogPost && (
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">Last Blog Post</p>
                    <p className="text-sm text-neutral-200">{p.lastBlogPost}</p>
                  </div>
                )}
                {/* Enrichment actors */}
                {p.enrichment_actors && p.enrichment_actors.length > 0 && (
                  <div>
                    <p className="text-xs text-neutral-400 mb-2">Enrichment Actors Used</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.enrichment_actors.map((actor, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-400 text-xs">
                          <LightningIcon size={10} />
                          {actor}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Campaign KPIs (inline editing) */}
          {ld.kpiDefinitions.length > 0 && (
            <CollapsibleSection
              title="Campaign KPIs"
              icon={ChartBarIcon}
              defaultOpen={true}
              action={
                kpiDirty ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={saveKpis}
                    disabled={savingKpis}
                    leftIcon={<FloppyDiskIcon size={12} />}
                  >
                    {savingKpis ? "Saving..." : "Save"}
                  </Button>
                ) : null
              }
            >
              <div className="space-y-3">
                {ld.kpiDefinitions.map((kpi) => (
                  <div key={kpi.id} className="flex items-center gap-4">
                    {kpi.type === "boolean" ? (
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <p className="text-sm text-neutral-50">{kpi.label}</p>
                          {kpi.description && <p className="text-xs text-neutral-500">{kpi.description}</p>}
                        </div>
                        <button
                          onClick={() => updateKpiValue(kpi.id, kpiValues[kpi.id] !== true)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${kpiValues[kpi.id] === true ? "bg-green-500" : "bg-neutral-700"}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${kpiValues[kpi.id] === true ? "translate-x-5" : ""}`} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-full space-y-1">
                        <p className="text-sm text-neutral-50">{kpi.label}</p>
                        {kpi.description && <p className="text-xs text-neutral-500">{kpi.description}</p>}
                        <Input
                          value={typeof kpiValues[kpi.id] === "string" ? (kpiValues[kpi.id] as string) : ""}
                          onChange={(e) => updateKpiValue(kpi.id, e.target.value)}
                          placeholder="Not set"
                          className="h-8 text-sm"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* KPI values from personalization (read-only, when no kpiDefinitions) */}
          {ld.kpiDefinitions.length === 0 && Object.keys(campaignKpis).length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-neutral-50 mb-4 flex items-center gap-2">
                <ChartBarIcon size={14} className="text-neutral-400" />
                KPI Values
              </h3>
              <div className="space-y-1">
                {Object.entries(campaignKpis).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-neutral-800/30 last:border-0">
                    <span className="text-xs text-neutral-400 capitalize">{key.replace(/_/g, " ")}</span>
                    {typeof value === "boolean" ? (
                      value ? (
                        <CheckCircleIcon size={16} className="text-green-400" />
                      ) : (
                        <XCircleIcon size={16} className="text-red-400" />
                      )
                    ) : (
                      <span className="text-xs text-neutral-50">{String(value)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mapped Data */}
          <CollapsibleSection title="Mapped Data" defaultOpen={true}>
            {ld.mappedData && Object.keys(ld.mappedData).length > 0 ? (
              <div className="space-y-1">
                {Object.entries(ld.mappedData).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between py-1.5 border-b border-neutral-800/30 last:border-0">
                    <span className="text-xs text-neutral-400 capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-xs text-neutral-50 text-right max-w-[60%] break-all">
                      {typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400">No mapped data available.</p>
            )}
          </CollapsibleSection>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-6">
          {/* Cost Breakdown */}
          {totalCost > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-neutral-50 mb-4 flex items-center gap-2">
                <CurrencyDollarIcon size={14} className="text-neutral-400" />
                Cost Breakdown
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-neutral-50">Total Cost</span>
                  <span className="text-lg font-bold tabular-nums text-neutral-50">${totalCost.toFixed(4)}</span>
                </div>
                <div className="border-t border-neutral-800" />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-neutral-400">Discovery</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-neutral-400">LLM</span>
                    <span className="text-right tabular-nums text-neutral-50">${discoveryLlm.toFixed(4)}</span>
                    <span className="text-neutral-400">Apify</span>
                    <span className="text-right tabular-nums text-neutral-50">${discoveryApify.toFixed(4)}</span>
                    <span className="font-medium text-neutral-50">Subtotal</span>
                    <span className="text-right font-medium tabular-nums text-neutral-50">${discoveryCost.toFixed(4)}</span>
                  </div>
                </div>
                {isEnrichedStatus && enrichmentCost > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-neutral-400">Enrichment</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-neutral-400">LLM</span>
                      <span className="text-right tabular-nums text-neutral-50">${enrichmentLlm.toFixed(4)}</span>
                      <span className="text-neutral-400">Apify</span>
                      <span className="text-right tabular-nums text-neutral-50">${enrichmentApify.toFixed(4)}</span>
                      <span className="font-medium text-neutral-50">Subtotal</span>
                      <span className="text-right font-medium tabular-nums text-neutral-50">${enrichmentCost.toFixed(4)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Raw Data */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="text-sm font-semibold text-neutral-50">Raw Data</span>
              <span className="text-xs text-neutral-400">{showRaw ? "Hide" : "Show"}</span>
            </button>
            {showRaw && (
              <div className="px-4 pb-4 space-y-3">
                {ld.rawData && <RawDataBlock title="Source Data" data={ld.rawData} onExpand={setJsonDialog} />}
                {p?.rawEnrichmentData && Object.keys(p.rawEnrichmentData).length > 0 && (() => {
                  const entries = Object.entries(p.rawEnrichmentData);
                  const isPerActor = entries.every(([k, v]) => k.includes("/") && v != null && typeof v === "object" && !Array.isArray(v));
                  if (isPerActor) {
                    return entries.map(([actorId, data]) => (
                      <RawDataBlock key={actorId} title={`Enrichment: ${actorId}`} data={data} onExpand={setJsonDialog} />
                    ));
                  }
                  return <RawDataBlock title="Enrichment Data" data={p.rawEnrichmentData} onExpand={setJsonDialog} />;
                })()}
                {ld.mappedData && Object.keys(ld.mappedData).length > 0 && (
                  <RawDataBlock title="Mapped Data" data={ld.mappedData} onExpand={setJsonDialog} />
                )}
              </div>
            )}
          </div>

          {/* Source & Created meta */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
            <div>
              <p className="text-xs text-neutral-400">Source</p>
              <a
                href={`https://apify.com/${ld.source}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:underline"
              >
                {ld.source}
                <ArrowSquareOutIcon size={12} />
              </a>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Created</p>
              <p className="text-sm text-neutral-50">
                {ld.createdAt
                  ? new Date(ld.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
                  : "--"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* JSON viewer modal */}
      <JsonModal dialog={jsonDialog} onClose={() => setJsonDialog(null)} />
    </div>
  );
}
