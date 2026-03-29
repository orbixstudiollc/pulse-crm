"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  XIcon,
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
  CopyIcon,
  ArrowSquareOutIcon,
  HashIcon,
  LinkIcon,
  TagIcon,
  FloppyDiskIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  Input,
  Button,
} from "@/components/ui";
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

export interface LeadDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  leadId: string | null;
  campaignId?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function norm(lead: LeadDetail) {
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

function formatVal(val: unknown, type: string): string {
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
}

// ── Collapsible Section ────────────────────────────────────────────────────

function Section({
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
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-neutral-800/30 transition-colors"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-50">
          {Icon && <Icon size={12} className="text-neutral-400" />}
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          {action && open && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
          {open ? (
            <CaretDownIcon size={12} className="text-neutral-400" />
          ) : (
            <CaretRightIcon size={12} className="text-neutral-400" />
          )}
        </div>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

// ── Info Row ───────────────────────────────────────────────────────────────

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
    <div className="flex items-start gap-2 py-1.5">
      {Icon && <Icon size={12} className="text-neutral-400 mt-0.5 shrink-0" />}
      <span className="text-[11px] text-neutral-400 w-20 shrink-0 mt-0.5">{label}</span>
      {value ? (
        link && strVal ? (
          <a
            href={strVal.startsWith("http") ? strVal : `https://${strVal}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:underline min-w-0 break-all"
          >
            {strVal}
          </a>
        ) : (
          <span className="text-xs text-neutral-50 min-w-0 break-all">{value}</span>
        )
      ) : (
        <span className="text-xs text-neutral-500 italic">Not set</span>
      )}
    </div>
  );
}

// ── Editable Row ──────────────────────────────────────────────────────────

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
    <div className="flex items-start gap-2 py-1">
      {Icon && <Icon size={12} className="text-neutral-400 mt-2 shrink-0" />}
      <span className="text-[11px] text-neutral-400 w-20 shrink-0 mt-1.5">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 text-xs"
      />
    </div>
  );
}

// ── Main Drawer Component ──────────────────────────────────────────────────

export function LeadDetailDrawer({ open, onClose, leadId, campaignId }: LeadDetailDrawerProps) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  // KPI editing
  const [kpiValues, setKpiValues] = useState<Record<string, boolean | string>>({});
  const [kpiDirty, setKpiDirty] = useState(false);
  const [savingKpis, setSavingKpis] = useState(false);

  // Contact inline editing
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editContactValues, setEditContactValues] = useState<Record<string, string>>({});
  const [savingContact, setSavingContact] = useState(false);

  const statusMenuRef = useRef<HTMLDivElement>(null);

  // ── Fetch lead ────────────────────────────────────────────────────────

  const fetchLead = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/lead-finder/leads/${leadId}`);
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
  }, [leadId]);

  useEffect(() => {
    if (open && leadId) {
      setLead(null);
      setIsEditingContact(false);
      setEditContactValues({});
      setStatusMenuOpen(false);
      fetchLead();
    }
  }, [open, leadId, fetchLead]);

  // ── Body scroll lock + escape ──────────────────────────────────────────

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Close status menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setStatusMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Real-time events ──────────────────────────────────────────────────

  useLeadEvents({
    campaignId: campaignId ?? undefined,
    enabled: open && !!leadId,
    onLeadKpiUpdated: (data) => {
      if (!kpiDirty && data.campaignKpis) {
        setKpiValues(data.campaignKpis as Record<string, boolean | string>);
      }
    },
    onLeadEnrichmentCompleted: () => fetchLead(),
    onLeadStatusChanged: () => fetchLead(),
  });

  // ── Actions ───────────────────────────────────────────────────────────

  const handleEnrich = async () => {
    if (!leadId) return;
    setEnriching(true);
    try {
      const res = await fetch(`/api/lead-finder/leads/${leadId}/enrich`, { method: "POST" });
      if (!res.ok) throw new Error("Enrichment failed");
      toast.success("Enrichment started");
      fetchLead();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setEnriching(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!leadId) return;
    setStatusMenuOpen(false);
    try {
      const res = await fetch(`/api/lead-finder/leads/${leadId}`, {
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
    if (!leadId) return;
    setImporting(true);
    try {
      const res = await fetch("/api/lead-finder/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", leadIds: [leadId] }),
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
    if (!leadId) return;
    setSavingKpis(true);
    try {
      await fetch(`/api/lead-finder/leads/${leadId}`, {
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

  // ── Contact editing ───────────────────────────────────────────────────

  const startEditingContact = () => {
    if (!lead) return;
    const ld = norm(lead);
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
    if (!lead || !leadId) return;
    const ld = norm(lead);
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
        const res = await fetch(`/api/lead-finder/leads/${leadId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed to save");
        toast.success("Contact info updated");
        fetchLead();
      }
      setIsEditingContact(false);
      setEditContactValues({});
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSavingContact(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  const isEnrichingFromServer = lead?.status === "enriching";
  const isEnrichingState = enriching || !!isEnrichingFromServer;

  const ld = lead ? norm(lead) : null;
  const p = lead?.personalization ?? null;
  const painPoints = getPainPoints(p);
  const techStack = getTechStack(p);
  const persSum = getPersonalizationSummary(p);
  const campaignKpis = getCampaignKpis(p);

  // Cost breakdown
  const discoveryLlm = ld?.discoveryLlmCostUsd ?? 0;
  const discoveryApify = ld?.discoveryApifyCostUsd ?? 0;
  const totalLlm = ld?.llmCostUsd ?? 0;
  const totalApify = ld?.apifyCostUsd ?? 0;
  const enrichmentLlm = totalLlm - discoveryLlm;
  const enrichmentApify = totalApify - discoveryApify;
  const discoveryCost = discoveryLlm + discoveryApify;
  const enrichmentCost = enrichmentLlm + enrichmentApify;
  const totalCost = totalLlm + totalApify;
  const isEnrichedStatus = lead ? lead.status !== "new" && lead.status !== "enriching" : false;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={onClose}
          />

          {/* Drawer — slides up from bottom */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 h-[85vh] bg-neutral-950 border-t border-neutral-800 rounded-t-2xl shadow-2xl z-50 flex flex-col"
          >
            {/* ── Loading state ─────────────────────────────────────────── */}
            {loading && (
              <div className="flex-1 flex items-center justify-center">
                <CircleNotchIcon size={28} className="animate-spin text-neutral-400" />
              </div>
            )}

            {/* ── Error state ──────────────────────────────────────────── */}
            {!loading && !lead && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2">
                <p className="text-sm text-neutral-400">Lead not found</p>
                <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
              </div>
            )}

            {/* ── Loaded ───────────────────────────────────────────────── */}
            {!loading && lead && ld && (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-neutral-50 truncate">
                          {ld.displayName || "Unknown Lead"}
                        </h2>
                        <ScoreBadge score={ld.score} />
                        {/* Status dropdown */}
                        <div className="relative" ref={statusMenuRef}>
                          <button
                            onClick={() => setStatusMenuOpen(!statusMenuOpen)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${STATUS_STYLES[lead.status] || "text-neutral-400 bg-neutral-800"}`}
                          >
                            {lead.status}
                            <CaretDownIcon size={10} />
                          </button>
                          {statusMenuOpen && (
                            <div className="absolute left-0 mt-1 w-40 bg-neutral-900 border border-neutral-800 rounded-lg shadow-lg z-30 py-1">
                              {ALL_STATUSES.map((s) => (
                                <button
                                  key={s}
                                  onClick={() => handleStatusChange(s)}
                                  disabled={s === lead.status}
                                  className="w-full text-left px-3 py-1.5 text-xs capitalize hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-default transition-colors flex items-center gap-2"
                                >
                                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_STYLES[s]?.split(" ")[0]?.replace("text-", "bg-") || "bg-neutral-500"}`} />
                                  <span className="text-neutral-50">{s}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        {ld.source?.replace(/_/g, " ") || "Unknown source"} | {ld.createdAt ? new Date(ld.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "--"}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons + close */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Enrich */}
                    {lead.status === "new" || lead.status === "enriching" ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleEnrich}
                        disabled={isEnrichingState}
                        leftIcon={isEnrichingState ? <CircleNotchIcon size={12} className="animate-spin" /> : <LightningIcon size={12} />}
                      >
                        {isEnrichingState ? "Enriching..." : "Enrich"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEnrich}
                        disabled={isEnrichingState}
                        leftIcon={<ArrowPathIcon size={12} className={isEnrichingState ? "animate-spin" : ""} />}
                      >
                        {isEnrichingState ? "Re-enriching..." : "Re-enrich"}
                      </Button>
                    )}

                    {/* Import to CRM */}
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleImportToCRM}
                      disabled={importing}
                      leftIcon={importing ? <CircleNotchIcon size={12} className="animate-spin" /> : <ArrowRightIcon size={12} />}
                    >
                      Import
                    </Button>

                    {/* Close */}
                    <button
                      onClick={onClose}
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-neutral-800 transition-colors"
                    >
                      <XIcon size={16} className="text-neutral-400" />
                    </button>
                  </div>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {/* ── Contact Information ──────────────────────────────── */}
                  <Section
                    title="Contact Information"
                    icon={EnvelopeIcon}
                    defaultOpen={true}
                    action={
                      isEditingContact ? (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={discardContactEdit} disabled={savingContact} leftIcon={<XIcon size={10} />}>
                            Discard
                          </Button>
                          <Button variant="primary" size="sm" onClick={saveContactEdit} disabled={savingContact} leftIcon={savingContact ? <CircleNotchIcon size={10} className="animate-spin" /> : <CheckIcon size={10} />}>
                            Save
                          </Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={startEditingContact} leftIcon={<PencilSimpleIcon size={10} />}>
                          Edit
                        </Button>
                      )
                    }
                  >
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
                  </Section>

                  {/* ── Personalization Insights ────────────────────────── */}
                  {p && (persSum || painPoints.length > 0 || techStack.length > 0 || p.hasChatbot || p.hasBookingSystem || p.companyDescription) && (
                    <Section title="Personalization Insights" icon={SparkleIcon} defaultOpen={true}>
                      <div className="space-y-3">
                        {persSum && (
                          <div>
                            <p className="text-[11px] text-neutral-400 mb-0.5">Summary</p>
                            <p className="text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap">{persSum}</p>
                          </div>
                        )}
                        {p.companyDescription && (
                          <div>
                            <p className="text-[11px] text-neutral-400 mb-0.5">About</p>
                            <p className="text-xs text-neutral-200">{p.companyDescription}</p>
                          </div>
                        )}
                        {painPoints.length > 0 && (
                          <div>
                            <p className="text-[11px] text-neutral-400 mb-1">Pain Points</p>
                            <div className="flex flex-wrap gap-1">
                              {painPoints.map((pp, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 text-[11px]">{pp}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {techStack.length > 0 && (
                          <div>
                            <p className="text-[11px] text-neutral-400 mb-1">Tech Stack</p>
                            <div className="flex flex-wrap gap-1">
                              {techStack.map((t, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-400 text-[11px]">{t}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(p.hasChatbot || p.hasBookingSystem) && (
                          <div>
                            <p className="text-[11px] text-neutral-400 mb-1">Detections</p>
                            <div className="flex flex-wrap gap-1">
                              {p.hasChatbot && <span className="px-1.5 py-0.5 rounded bg-violet-400/10 text-violet-400 text-[11px]">Chatbot</span>}
                              {p.hasBookingSystem && <span className="px-1.5 py-0.5 rounded bg-violet-400/10 text-violet-400 text-[11px]">Booking System</span>}
                            </div>
                          </div>
                        )}
                        {p.lastBlogPost && (
                          <div>
                            <p className="text-[11px] text-neutral-400 mb-0.5">Last Blog Post</p>
                            <p className="text-xs text-neutral-200">{p.lastBlogPost}</p>
                          </div>
                        )}
                        {p.enrichment_actors && p.enrichment_actors.length > 0 && (
                          <div>
                            <p className="text-[11px] text-neutral-400 mb-1">Enrichment Actors</p>
                            <div className="flex flex-wrap gap-1">
                              {p.enrichment_actors.map((actor, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 text-[11px]">
                                  <LightningIcon size={9} />
                                  {actor}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </Section>
                  )}

                  {/* ── Campaign KPIs (editable) ───────────────────────── */}
                  {ld.kpiDefinitions.length > 0 && (
                    <Section
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
                            leftIcon={<FloppyDiskIcon size={10} />}
                          >
                            {savingKpis ? "Saving..." : "Save"}
                          </Button>
                        ) : null
                      }
                    >
                      <div className="space-y-2">
                        {ld.kpiDefinitions.map((kpi) => (
                          <div key={kpi.id} className="flex items-center gap-3">
                            {kpi.type === "boolean" ? (
                              <div className="flex items-center justify-between w-full">
                                <div>
                                  <p className="text-xs text-neutral-50">{kpi.label}</p>
                                  {kpi.description && <p className="text-[11px] text-neutral-500">{kpi.description}</p>}
                                </div>
                                <button
                                  onClick={() => updateKpiValue(kpi.id, kpiValues[kpi.id] !== true)}
                                  className={`relative w-9 h-[18px] rounded-full transition-colors ${kpiValues[kpi.id] === true ? "bg-green-500" : "bg-neutral-700"}`}
                                >
                                  <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${kpiValues[kpi.id] === true ? "translate-x-[18px]" : ""}`} />
                                </button>
                              </div>
                            ) : (
                              <div className="w-full space-y-0.5">
                                <p className="text-xs text-neutral-50">{kpi.label}</p>
                                {kpi.description && <p className="text-[11px] text-neutral-500">{kpi.description}</p>}
                                <Input
                                  value={typeof kpiValues[kpi.id] === "string" ? (kpiValues[kpi.id] as string) : ""}
                                  onChange={(e) => updateKpiValue(kpi.id, e.target.value)}
                                  placeholder="Not set"
                                  className="h-7 text-xs"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* ── Read-only KPI values (no definitions) ──────────── */}
                  {ld.kpiDefinitions.length === 0 && Object.keys(campaignKpis).length > 0 && (
                    <Section title="KPI Values" icon={ChartBarIcon} defaultOpen={true}>
                      <div className="space-y-0.5">
                        {Object.entries(campaignKpis).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between py-1.5 border-b border-neutral-800/30 last:border-0">
                            <span className="text-[11px] text-neutral-400 capitalize">{key.replace(/_/g, " ")}</span>
                            {typeof value === "boolean" ? (
                              value ? <CheckCircleIcon size={14} className="text-green-400" /> : <XCircleIcon size={14} className="text-red-400" />
                            ) : (
                              <span className="text-[11px] text-neutral-50">{String(value)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* ── Mapped Data ─────────────────────────────────────── */}
                  {ld.mappedData && Object.keys(ld.mappedData).length > 0 && (
                    <Section title="Dynamic Fields" icon={TagIcon} defaultOpen={false}>
                      <div className="space-y-0.5">
                        {Object.entries(ld.mappedData).map(([key, value]) => (
                          <div key={key} className="flex items-start justify-between py-1 border-b border-neutral-800/30 last:border-0">
                            <span className="text-[11px] text-neutral-400 capitalize">{key.replace(/_/g, " ")}</span>
                            <span className="text-[11px] text-neutral-50 text-right max-w-[60%] break-all">
                              {typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* ── Cost Breakdown ──────────────────────────────────── */}
                  {totalCost > 0 && (
                    <Section title="Cost Breakdown" icon={CurrencyDollarIcon} defaultOpen={false}>
                      <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs font-medium text-neutral-50">Total Cost</span>
                          <span className="text-sm font-bold tabular-nums text-neutral-50">${totalCost.toFixed(4)}</span>
                        </div>
                        <div className="border-t border-neutral-800" />
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-medium text-neutral-400">Discovery</p>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                            <span className="text-neutral-400">LLM</span>
                            <span className="text-right tabular-nums text-neutral-50">${discoveryLlm.toFixed(4)}</span>
                            <span className="text-neutral-400">Apify</span>
                            <span className="text-right tabular-nums text-neutral-50">${discoveryApify.toFixed(4)}</span>
                            <span className="font-medium text-neutral-50">Subtotal</span>
                            <span className="text-right font-medium tabular-nums text-neutral-50">${discoveryCost.toFixed(4)}</span>
                          </div>
                        </div>
                        {isEnrichedStatus && enrichmentCost > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-medium text-neutral-400">Enrichment</p>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
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
                    </Section>
                  )}

                  {/* ── Raw Data ────────────────────────────────────────── */}
                  <Section title="Raw Data" defaultOpen={false}>
                    <div className="space-y-2">
                      {ld.rawData && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] font-medium text-neutral-400">Source Data</p>
                            <button
                              onClick={() => navigator.clipboard.writeText(JSON.stringify(ld.rawData, null, 2)).then(() => toast.success("Copied"))}
                              className="rounded p-0.5 text-neutral-400 hover:bg-neutral-800 transition-colors"
                              title="Copy JSON"
                            >
                              <CopyIcon size={12} />
                            </button>
                          </div>
                          <pre className="max-h-40 overflow-auto rounded bg-neutral-950 border border-neutral-800 p-2 text-[11px] text-neutral-300">
                            {JSON.stringify(ld.rawData, null, 2)}
                          </pre>
                        </div>
                      )}
                      {p?.rawEnrichmentData && Object.keys(p.rawEnrichmentData).length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] font-medium text-neutral-400">Enrichment Data</p>
                            <button
                              onClick={() => navigator.clipboard.writeText(JSON.stringify(p.rawEnrichmentData, null, 2)).then(() => toast.success("Copied"))}
                              className="rounded p-0.5 text-neutral-400 hover:bg-neutral-800 transition-colors"
                              title="Copy JSON"
                            >
                              <CopyIcon size={12} />
                            </button>
                          </div>
                          <pre className="max-h-40 overflow-auto rounded bg-neutral-950 border border-neutral-800 p-2 text-[11px] text-neutral-300">
                            {JSON.stringify(p.rawEnrichmentData, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </Section>

                  {/* ── Source & Meta ───────────────────────────────────── */}
                  <div className="flex items-center gap-4 text-[11px] text-neutral-400 pt-1 pb-2">
                    <span>Source: <a href={`https://apify.com/${ld.source}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{ld.source} <ArrowSquareOutIcon size={10} className="inline" /></a></span>
                    <span>Created: {ld.createdAt ? new Date(ld.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "--"}</span>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
