"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  PlayIcon,
  PauseIcon,
  SparkleIcon,
  UsersIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  CircleNotchIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  DownloadIcon,
  MagnifyingGlassIcon,
  GearIcon,
  LightningIcon,
  ArrowRightIcon,
  EnvelopeIcon,
  GlobeIcon,
  SlidersHorizontalIcon,
  PlusIcon,
  XIcon,
  ClockIcon,
  WarningCircleIcon,
  ArrowCounterClockwiseIcon,
  PowerIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  HashIcon,
  LinkIcon,
  TextTIcon,
  BarChartIcon,
  TagIcon,
  CaretRightIcon,
  CaretDownIcon as ChevronDownIcon,
  InfoIcon,
} from "@/components/ui";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { ScoreBadge } from "@/components/lead-finder/ScoreBadge";
import { LeadDetailDrawer } from "@/components/lead-finder/LeadDetailDrawer";
import { LeadFinderSubNav } from "@/components/lead-finder/SubNav";
import { EnrichmentProgressBanner, registerActiveBatch } from "@/components/lead-finder/EnrichmentProgressBanner";
import { SortableList } from "@/components/lead-finder/SortableList";
import { useLeadEvents } from "@/hooks/use-lead-events";
import { useLeadFinderActors } from "@/hooks/use-lead-finder-actors";

// ── Types ───────────────────────────────────────────────────────────────────

interface LeadFieldDefinition {
  id?: string;
  key?: string;
  label: string;
  type: "text" | "number" | "boolean" | "url";
  description?: string;
}

interface KpiDefinition {
  id?: string;
  key?: string;
  label: string;
  type: "boolean" | "text";
  description?: string;
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
  personalization?: {
    campaign_kpis?: Record<string, boolean | string>;
  } | null;
}

interface CampaignRun {
  id: string;
  actor_id: string;
  status: string;
  result_count: number;
  cost_usd: number | null;
  started_at: string;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  target_niche: string;
  status: string;
  ai_provider: string;
  schedule_frequency: string;
  auto_enrich: boolean;
  apify_actors: string[];
  actor_configs: Record<string, Record<string, unknown>>;
  kpi_definitions: KpiDefinition[];
  lead_field_definitions: LeadFieldDefinition[];
  enrichment_concurrency: number | null;
  last_discovery_at: string | null;
  leads: Lead[];
  runs: CampaignRun[];
  stats: {
    totalLeads: number;
    enrichedLeads: number;
    qualifiedLeads: number;
    convertedLeads: number;
    avgScore: number;
    apifyCost: number;
    llmCost: number;
    totalCost: number;
    avgCostPerLead: number;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function resolveFieldId(f: LeadFieldDefinition | KpiDefinition): string {
  return (f.id ?? (f as { key?: string }).key ?? "");
}

function resolveFieldValue(
  lead: Lead,
  field: LeadFieldDefinition
): { display: string; isUrl: boolean } {
  const fid = resolveFieldId(field);
  const mapped = lead.mapped_data ?? {};
  const raw = lead.raw_data ?? {};
  const val = mapped[fid] ?? raw[fid];

  if (val == null) return { display: "—", isUrl: false };

  if (field.type === "boolean") {
    return {
      display: val === true || val === "true" ? "Yes" : val === false || val === "false" ? "No" : String(val),
      isUrl: false,
    };
  }
  if (field.type === "number" && typeof val === "number") {
    return { display: val.toLocaleString(), isUrl: false };
  }
  if (field.type === "url" && typeof val === "string" && val.startsWith("http")) {
    return { display: val, isUrl: true };
  }
  if (typeof val === "object") {
    if (Array.isArray(val)) {
      if (val.length === 0) return { display: "—", isUrl: false };
      const joined = val
        .filter((v) => v != null)
        .map((item) =>
          typeof item !== "object" || item === null
            ? String(item)
            : Object.values(item as Record<string, unknown>)
                .filter((v) => v != null)
                .map(String)
                .join(": ")
        )
        .join(", ");
      return { display: joined, isUrl: false };
    }
    const entries = Object.entries(val as Record<string, unknown>)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    return { display: entries || "—", isUrl: false };
  }
  const strVal = String(val);
  const isUrl = strVal.startsWith("http");
  return { display: strVal, isUrl };
}

const STATUS_STYLES: Record<string, string> = {
  new: "text-accent-on-surface bg-accent-surface",
  enriching: "text-warning bg-warning-surface animate-pulse",
  "awaiting enrichment": "text-fg-secondary bg-muted",
  qualified: "text-success bg-success-surface",
  converted: "text-success bg-success-surface",
  disqualified: "text-danger bg-danger-surface",
  declined: "text-danger bg-danger-surface",
  archived: "text-fg-secondary bg-muted",
};

// ── Main Component ───────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getActorById, getActorsByPhase } = useLeadFinderActors();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  // Discovery / Enrichment
  const [runningActor, setRunningActor] = useState<string | null>(null);
  const [lastActorResult, setLastActorResult] = useState<{ actorId: string; inserted: number; total: number } | null>(null);
  const [discoveryProgress, setDiscoveryProgress] = useState<{ current: number; total: number } | null>(null);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [enrichingAll, setEnrichingAll] = useState(false);
  const enrichAbortRef = useRef<AbortController | null>(null);
  const [reEnrichingLeads, setReEnrichingLeads] = useState<Set<string>>(new Set());

  // Drawer
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);

  // Table
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [extraColumns, setExtraColumns] = useState<Set<string>>(new Set());
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  // Settings panel
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editSettings, setEditSettings] = useState<{
    targetNiche: string;
    aiProvider: string;
    scheduleFrequency: string;
    autoEnrich: boolean;
    enrichmentConcurrency: number | "";
    actorConfigs: Record<string, Record<string, string>>;
    actorOrder: string[];
  } | null>(null);
  const [editLeadFields, setEditLeadFields] = useState<LeadFieldDefinition[]>([]);
  const [editKpis, setEditKpis] = useState<KpiDefinition[]>([]);
  const [collapsedActors, setCollapsedActors] = useState<Set<string>>(new Set());
  const [addActorOpen, setAddActorOpen] = useState(false);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearLeadsConfirm, setShowClearLeadsConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clearingLeads, setClearingLeads] = useState(false);

  // Cost breakdown popover
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);

  // ── Load campaign ──────────────────────────────────────────────────────────

  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNow = useCallback(async () => {
    try {
      const res = await fetch(`/api/lead-finder/campaigns/${id}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setCampaign(json.data);
    } catch {
      toast.error("Failed to load campaign");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetch300 = useCallback(() => {
    if (loadTimer.current) clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(fetchNow, 300);
  }, [fetchNow]);

  useEffect(() => { fetchNow(); }, [fetchNow]);

  // ── Real-time events ───────────────────────────────────────────────────────

  useLeadEvents({
    campaignId: id,
    enabled: !!campaign,
    onLeadDiscovered: (data) => {
      const d = data as Record<string, unknown>;
      setDiscoveryProgress({ current: (d.index as number) || 0, total: (d.totalItems as number) || 0 });
      setCampaign((prev) => {
        if (!prev) return prev;
        if (prev.leads.some((l) => l.id === d.leadId)) return prev;
        const newLead: Lead = {
          id: d.leadId as string,
          campaign_id: id,
          display_name: (d.displayName as string) || null,
          email: (d.email as string) || null,
          phone: null,
          website: (d.website as string) || null,
          score: 0,
          status: (d.status as string) || "new",
          source: (d.source as string) || "",
          raw_data: (d.rawData as Record<string, unknown>) || null,
          mapped_data: null,
          llm_cost_usd: 0,
          created_at: (d.createdAt as string) || new Date().toISOString(),
        };
        return { ...prev, leads: [newLead, ...prev.leads], stats: { ...prev.stats, totalLeads: prev.stats.totalLeads + 1 } };
      });
    },
    onLeadStatusChanged: (data) => {
      const d = data as Record<string, unknown>;
      setCampaign((prev) => {
        if (!prev) return prev;
        return { ...prev, leads: prev.leads.map((l) => l.id === d.leadId ? { ...l, status: d.newStatus as string } : l) };
      });
    },
    onLeadEnrichmentCompleted: (data) => {
      const d = data as Record<string, unknown>;
      setReEnrichingLeads((prev) => { const next = new Set(prev); next.delete(d.leadId as string); return next; });
      fetch300();
    },
    onLeadKpiUpdated: () => fetch300(),
    onDiscoveryStarted: (data) => {
      const d = data as Record<string, unknown>;
      const ids = d.actorIds as string[];
      if (ids?.length) setRunningActor(ids[0]);
      setDiscoveryProgress(null);
    },
    onDiscoveryCompleted: () => {
      setRunningActor(null);
      setDiscoveryProgress(null);
      fetch300();
    },
    onEnrichmentProgress: () => fetch300(),
  });

  // ── Computed ───────────────────────────────────────────────────────────────

  if (loading || !campaign) {
    return (
      <div className="min-h-screen bg-subtle flex items-center justify-center">
        <CircleNotchIcon size={32} className="animate-spin text-fg-muted" />
      </div>
    );
  }

  const fields = (campaign.lead_field_definitions || []).map((f) => ({ ...f, _id: resolveFieldId(f) }));
  // kpis are rendered via a subcomponent that reads kpi_definitions directly;
  // this computed list is retained for future in-place editing.
  void (campaign.kpi_definitions || []).map((k) => ({ ...k, _id: resolveFieldId(k) }));

  const serverIsEnriching = campaign.leads.some((l) => l.status === "enriching");
  const isEnrichmentActive = enrichingAll || serverIsEnriching || reEnrichingLeads.size > 0;
  const unenrichedCount = campaign.leads.filter((l) => l.status === "new" || l.status === "enriching").length;
  const hasUnenrichedLeads = unenrichedCount > 0;

  const latestRunByActor = new Map<string, CampaignRun>();
  for (const run of campaign.runs) {
    const existing = latestRunByActor.get(run.actor_id);
    if (!existing || new Date(run.started_at) > new Date(existing.started_at)) {
      latestRunByActor.set(run.actor_id, run);
    }
  }

  const findActors = (campaign.apify_actors || []).filter((aid) => getActorById(aid)?.phase === "find");
  const enrichActors = (campaign.apify_actors || []).filter((aid) => getActorById(aid)?.phase === "enrich");

  const filteredLeads = campaign.leads.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return l.display_name?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) || l.website?.toLowerCase().includes(q);
    }
    return true;
  });

  const displayStatus = (lead: Lead) => {
    if (reEnrichingLeads.has(lead.id)) return "enriching";
    if ((lead.status === "new" || lead.status === "enriching") && !isEnrichmentActive) return "awaiting enrichment";
    return lead.status;
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleRunActor = async (actorId: string) => {
    setRunningActor(actorId);
    setDiscoveryError(null);
    try {
      const res = await fetch(`/api/lead-finder/campaigns/${id}/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDiscoveryError(data.error || "Actor run failed");
        return;
      }
      const inserted = data.inserted ?? 0;
      const total = data.totalResults ?? 0;
      setLastActorResult({ actorId, inserted, total });
      setTimeout(() => setLastActorResult(null), 10000);
      if (inserted > 0) {
        toast.success(`${inserted} new leads from ${getActorById(actorId)?.name || actorId}`);
        if (campaign.auto_enrich && !enrichingAll) triggerEnrichment();
      } else {
        toast.info("Actor completed — no new leads found");
      }
      fetch300();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setRunningActor(null);
      setDiscoveryProgress(null);
    }
  };

  const triggerEnrichment = async () => {
    setEnrichingAll(true);
    const abort = new AbortController();
    enrichAbortRef.current = abort;
    try {
      const res = await fetch(`/api/lead-finder/campaigns/${id}/enrich`, {
        method: "POST",
        signal: abort.signal,
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Enrichment failed"); return; }
      if (data.batchId) registerActiveBatch(data.batchId);
      if (data.enriched > 0) toast.success(`Enriched ${data.enriched} leads`);
      else toast.info("No new leads to enrich");
      fetch300();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(String(err));
    } finally {
      setEnrichingAll(false);
      enrichAbortRef.current = null;
    }
  };

  const handlePauseEnrichment = async () => {
    enrichAbortRef.current?.abort();
    enrichAbortRef.current = null;
    setEnrichingAll(false);
    await fetch(`/api/lead-finder/campaigns/${id}/enrich`, { method: "DELETE" }).catch(() => {});
    fetch300();
  };

  const handleReEnrich = (leadId: string) => {
    setReEnrichingLeads((prev) => new Set(prev).add(leadId));
    setCampaign((prev) => prev ? { ...prev, leads: prev.leads.map((l) => l.id === leadId ? { ...l, status: "enriching" } : l) } : prev);
    fetch(`/api/lead-finder/leads/${leadId}/enrich`, { method: "POST" })
      .then((res) => { if (!res.ok) throw new Error("Failed"); toast.success("Re-enrichment started"); })
      .catch(() => toast.error("Failed to re-enrich"))
      .finally(() => { setReEnrichingLeads((prev) => { const n = new Set(prev); n.delete(leadId); return n; }); fetch300(); });
  };

  const handleSkip = async (leadId: string) => {
    await fetch(`/api/lead-finder/leads/${leadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "qualified", score: 0 }),
    });
    toast.success("Lead skipped");
    fetch300();
  };

  const handleDeleteLead = async (leadId: string) => {
    await fetch(`/api/lead-finder/leads/${leadId}`, { method: "DELETE" });
    setCampaign((prev) => prev ? { ...prev, leads: prev.leads.filter((l) => l.id !== leadId) } : prev);
    setSelectedLeads((prev) => { const n = new Set(prev); n.delete(leadId); return n; });
    toast.success("Lead deleted");
  };

  const handleDeleteCampaign = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/lead-finder/campaigns/${id}`, { method: "DELETE" });
      toast.success("Campaign deleted");
      router.push("/dashboard/lead-finder/campaigns");
    } catch { toast.error("Failed to delete"); setDeleting(false); }
  };

  const handleClearLeads = async () => {
    setClearingLeads(true);
    try {
      await fetch(`/api/lead-finder/campaigns/${id}/leads`, { method: "DELETE" });
      setCampaign((prev) => prev ? { ...prev, leads: [], stats: { ...prev.stats, totalLeads: 0, enrichedLeads: 0, qualifiedLeads: 0, convertedLeads: 0, avgScore: 0 } } : prev);
      setSelectedLeads(new Set());
      toast.success("All leads cleared");
    } catch { toast.error("Failed to clear leads"); }
    finally { setClearingLeads(false); setShowClearLeadsConfirm(false); }
  };

  const handleImportToCRM = async () => {
    const ids = Array.from(selectedLeads);
    if (!ids.length) { toast.error("Select leads to import"); return; }
    setImporting(true);
    try {
      await fetch("/api/lead-finder/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "import", leadIds: ids }) });
      toast.success(`${ids.length} lead(s) imported`);
      setSelectedLeads(new Set());
    } catch { toast.error("Import failed"); }
    finally { setImporting(false); }
  };

  const handleExportCSV = () => {
    const headers = ["Name", "Email", "Phone", "Website", "Score", "Status", "Source", "Created"];
    const rows = filteredLeads.map((l) => [l.display_name || "", l.email || "", l.phone || "", l.website || "", l.score, l.status, l.source, l.created_at]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${campaign.name}-leads.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleActivatePause = async () => {
    const newStatus = campaign.status === "active" ? "paused" : "active";
    await fetch(`/api/lead-finder/campaigns/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    setCampaign((prev) => prev ? { ...prev, status: newStatus } : prev);
    toast.success(`Campaign ${newStatus}`);
  };

  // ── Settings helpers ───────────────────────────────────────────────────────

  const openSettings = () => {
    const configs: Record<string, Record<string, string>> = {};
    for (const actorId of campaign.apify_actors || []) {
      const config = campaign.actor_configs?.[actorId] || {};
      configs[actorId] = {};
      for (const [k, v] of Object.entries(config)) {
        configs[actorId][k] = Array.isArray(v) ? (v as string[]).join(", ") : String(v ?? "");
      }
    }
    setEditSettings({
      targetNiche: campaign.target_niche,
      aiProvider: campaign.ai_provider,
      scheduleFrequency: campaign.schedule_frequency,
      autoEnrich: campaign.auto_enrich,
      enrichmentConcurrency: campaign.enrichment_concurrency ?? "",
      actorConfigs: configs,
      actorOrder: [...(campaign.apify_actors || [])],
    });
    setEditLeadFields((campaign.lead_field_definitions || []).map((f) => ({ ...f })));
    setEditKpis((campaign.kpi_definitions || []).map((k) => ({ ...k })));
    setCollapsedActors(new Set(campaign.apify_actors || []));
    setShowSettings(true);
  };

  const handleSaveSettings = async () => {
    if (!editSettings) return;
    setSavingSettings(true);
    try {
      const actorConfigs: Record<string, Record<string, unknown>> = {};
      for (const actorId of editSettings.actorOrder) {
        const actorDef = getActorById(actorId);
        if (!actorDef) continue;
        const input: Record<string, unknown> = { ...(actorDef.defaultInput || {}) };
        const edited = editSettings.actorConfigs[actorId] || {};
        for (const [fieldName, rawValue] of Object.entries(edited)) {
          const desc = actorDef.inputFieldDescriptions?.[fieldName];
          if (!String(rawValue).trim()) continue;
          if (desc?.type === "string-array") {
            input[fieldName] = String(rawValue).split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
          } else if (desc?.type === "number") {
            input[fieldName] = Number(rawValue) || 0;
          } else {
            input[fieldName] = rawValue;
          }
        }
        actorConfigs[actorId] = input;
      }

      const res = await fetch(`/api/lead-finder/campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_niche: editSettings.targetNiche,
          ai_provider: editSettings.aiProvider,
          schedule_frequency: editSettings.scheduleFrequency,
          auto_enrich: editSettings.autoEnrich,
          enrichment_concurrency: editSettings.enrichmentConcurrency === "" ? null : Number(editSettings.enrichmentConcurrency),
          actor_configs: actorConfigs,
          apify_actors: editSettings.actorOrder,
          lead_field_definitions: editLeadFields.filter((f) => f.label.trim()),
          kpi_definitions: editKpis.filter((k) => k.label.trim()),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save settings");
      }

      if (!editSettings.autoEnrich && isEnrichmentActive) {
        enrichAbortRef.current?.abort();
        await fetch(`/api/lead-finder/campaigns/${id}/enrich`, { method: "DELETE" }).catch(() => {});
      }

      toast.success("Settings saved");
      setShowSettings(false);
      fetchNow();
    } catch { toast.error("Failed to save settings"); }
    finally { setSavingSettings(false); }
  };

  const findExistingSearchTerms = (): string | null => {
    if (!editSettings) return null;
    for (const actorId of editSettings.actorOrder) {
      const def = getActorById(actorId);
      if (def?.phase !== "find") continue;
      const config = editSettings.actorConfigs[actorId] || {};
      for (const [fieldName, desc] of Object.entries(def.inputFieldDescriptions || {})) {
        if (desc.type === "string-array" && config[fieldName]?.trim()) return config[fieldName];
      }
    }
    return null;
  };

  const addActorToSettings = (actorId: string) => {
    if (!editSettings) return;
    const def = getActorById(actorId);
    if (!def) return;
    const prefilled: Record<string, string> = {};
    if (def.phase === "find" && def.inputFieldDescriptions) {
      const existing = findExistingSearchTerms();
      for (const [fieldName, desc] of Object.entries(def.inputFieldDescriptions)) {
        if (desc.type === "string-array" && existing) prefilled[fieldName] = existing;
        else if (desc.type === "number" && def.defaultInput?.[fieldName] != null) prefilled[fieldName] = String(def.defaultInput[fieldName]);
      }
    }
    if (def.defaultInput) {
      for (const [k, v] of Object.entries(def.defaultInput)) {
        if (!prefilled[k] && v != null) prefilled[k] = Array.isArray(v) ? (v as string[]).join(", ") : String(v);
      }
    }
    setEditSettings({ ...editSettings, actorOrder: [...editSettings.actorOrder, actorId], actorConfigs: { ...editSettings.actorConfigs, [actorId]: prefilled } });
    const hasFields = def.phase !== "enrich" && Object.keys(def.inputFieldDescriptions || {}).length > 0;
    setCollapsedActors((prev) => { const n = new Set(prev); if (hasFields) n.delete(actorId); else n.add(actorId); return n; });
    setAddActorOpen(false);
  };

  const removeActorFromSettings = (actorId: string) => {
    if (!editSettings) return;
    const { [actorId]: _removed, ...rest } = editSettings.actorConfigs;
    setEditSettings({ ...editSettings, actorOrder: editSettings.actorOrder.filter((a) => a !== actorId), actorConfigs: rest });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-6 space-y-5">
      <LeadFinderSubNav />

      <EnrichmentProgressBanner campaignId={id} />

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/lead-finder/campaigns" className="p-2 rounded-md bg-surface border border-line text-fg-secondary hover:bg-muted hover:text-fg transition-colors">
            <ArrowLeftIcon size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-fg">{campaign.name}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${campaign.status === "active" ? "text-success bg-success-surface" : campaign.status === "paused" ? "text-warning bg-warning-surface" : "text-fg-secondary bg-muted"}`}>
                {campaign.status}
              </span>
            </div>
            <p className="text-sm text-fg-secondary mt-0.5">{campaign.target_niche}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowClearLeadsConfirm(true)} disabled={campaign.leads.length === 0} variant="secondary" size="sm" leftIcon={<TrashIcon size={14} />} className="text-fg-secondary hover:text-danger hover:bg-danger-surface">
            Clear Leads
          </Button>
          <Button onClick={() => setShowDeleteConfirm(true)} variant="secondary" size="sm" className="w-9 px-0 text-fg-secondary hover:text-danger hover:bg-danger-surface" title="Delete Campaign">
            <TrashIcon size={15} />
          </Button>
          <Button onClick={openSettings} variant="secondary" size="sm" leftIcon={<GearIcon size={15} />}>
            Settings
          </Button>
          <Button onClick={handleActivatePause} variant="outline" size="sm" className={campaign.status === "active" ? "bg-warning-surface text-warning border-warning hover:bg-warning-surface" : "bg-success-surface text-success border-success hover:bg-success-surface"}>
            {campaign.status === "active" ? <><PauseIcon size={14} /> Pause</> : <><PlayIcon size={14} /> Activate</>}
          </Button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="bg-surface border border-line rounded-lg">
        <div className="flex flex-wrap items-stretch divide-x divide-row">
          {[
            { label: "Leads", value: campaign.stats.totalLeads, icon: <UsersIcon size={12} /> },
            { label: "Enriched", value: campaign.stats.enrichedLeads, icon: <SparkleIcon size={12} /> },
            { label: "Avg Score", value: campaign.stats.avgScore, icon: <ChartBarIcon size={12} /> },
          ].map((s) => (
            <div key={s.label} className="flex-1 min-w-[90px] p-4">
              <div className="flex items-center gap-1 text-fg-secondary mb-1">
                {s.icon}
                <span className="text-xs">{s.label}</span>
              </div>
              <p className="text-[22px] leading-7 font-semibold text-fg">{s.value}</p>
            </div>
          ))}
          <div className="relative flex-1 min-w-[120px] p-4 cursor-pointer hover:bg-muted transition-colors" onClick={() => setShowCostBreakdown((v) => !v)}>
            <div className="flex items-center gap-1 text-fg-secondary mb-1">
              <CurrencyDollarIcon size={12} />
              <span className="text-xs">Total Cost</span>
              <InfoIcon size={10} className="ml-0.5" />
            </div>
            <p className="text-[22px] leading-7 font-semibold text-fg">${campaign.stats.totalCost.toFixed(4)}</p>
            {showCostBreakdown && (
              <>
                <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setShowCostBreakdown(false); }} />
                <div className="absolute left-0 top-full z-40 mt-1 w-52 bg-surface border border-line rounded-lg shadow-dropdown p-3 space-y-2">
                  <p className="text-xs text-fg-secondary font-medium">Cost Breakdown</p>
                  {[
                    ["Avg / Lead", `$${campaign.stats.avgCostPerLead.toFixed(4)}`],
                    ["Apify", `$${campaign.stats.apifyCost.toFixed(4)}`],
                    ["LLM", `$${campaign.stats.llmCost.toFixed(4)}`],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-fg-secondary">{label}</span>
                      <span className="font-medium text-fg">{val}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Discovery Configuration ── */}
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-fg">Discovery Configuration</h2>
            {campaign.last_discovery_at && (
              <p className="text-xs text-fg-secondary mt-0.5">
                Last run: {new Date(campaign.last_discovery_at).toLocaleString()}
              </p>
            )}
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-fg-secondary bg-muted border border-line">
            <ClockIcon size={10} /> {campaign.schedule_frequency}
          </span>
        </div>
        <div className="p-4 space-y-3">
          {/* Find actors */}
          {findActors.map((actorId) => {
            const actor = getActorById(actorId);
            const latestRun = latestRunByActor.get(actorId);
            const actorIsRunning = runningActor === actorId || latestRun?.status === "running";
            const anyRunning = runningActor !== null;
            return (
              <div key={actorId} className="rounded-lg border border-line p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg">{actor?.name || actorId}</p>
                    <p className="text-xs text-fg-secondary mt-0.5">{actor?.description || ""}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {actorIsRunning ? (
                      <span className="inline-flex items-center gap-1 text-xs text-warning">
                        <CircleNotchIcon size={12} className="animate-spin" /> Running
                      </span>
                    ) : latestRun?.status === "succeeded" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success">
                        <CheckCircleIcon size={12} /> {latestRun.result_count} results
                      </span>
                    ) : latestRun?.status === "failed" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-danger">
                        <XCircleIcon size={12} /> Failed
                      </span>
                    ) : (
                      <span className="text-xs text-fg-muted">Not run yet</span>
                    )}
                    <Button
                      onClick={() => handleRunActor(actorId)}
                      disabled={anyRunning || campaign.status !== "active"}
                      variant="secondary"
                      size="sm"
                      className="h-8 text-xs"
                    >
                      {actorIsRunning ? <><CircleNotchIcon size={12} className="animate-spin" /> Running...</> : <><PlayIcon size={12} /> Run Scraper</>}
                    </Button>
                  </div>
                </div>
                {lastActorResult?.actorId === actorId && (
                  <p className="text-xs text-success mt-2">
                    Found {lastActorResult.total} results — {lastActorResult.inserted} new leads added
                  </p>
                )}
                {actorIsRunning && (
                  <p className="text-xs text-fg-secondary mt-2">
                    {discoveryProgress
                      ? `Processing lead ${discoveryProgress.current} of ${discoveryProgress.total}...`
                      : "Scraping in progress — this may take 1–2 minutes..."}
                  </p>
                )}
              </div>
            );
          })}

          {/* Discovery error */}
          {discoveryError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-danger-surface border border-danger text-sm text-danger">
              <WarningCircleIcon size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Discovery Error</p>
                <p className="text-xs mt-0.5">{discoveryError}</p>
              </div>
              <Button onClick={() => setDiscoveryError(null)} variant="ghost" size="sm" className="ml-auto text-danger hover:text-danger px-1">
                <XIcon size={14} />
              </Button>
            </div>
          )}

          {/* Enrich actors */}
          {enrichActors.length > 0 && (
            <>
              <div className="border-t border-row pt-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-fg">Lead Enrichment</p>
                  <p className="text-xs text-fg-secondary mt-0.5">
                    {isEnrichmentActive ? (
                      <span className="flex items-center gap-1"><CircleNotchIcon size={10} className="animate-spin" /> Enriching {unenrichedCount} leads...</span>
                    ) : hasUnenrichedLeads ? (
                      `${unenrichedCount} leads awaiting enrichment`
                    ) : "All leads enriched"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {campaign.auto_enrich && isEnrichmentActive ? (
                    <Button onClick={handlePauseEnrichment} variant="outline" size="sm" leftIcon={<PauseIcon size={12} />} className="h-8 text-xs">
                      Pause
                    </Button>
                  ) : campaign.auto_enrich && !isEnrichmentActive && hasUnenrichedLeads ? (
                    <Button onClick={triggerEnrichment} variant="primary" size="sm" leftIcon={<PlayIcon size={12} />} className="h-8 text-xs">
                      Resume
                    </Button>
                  ) : !campaign.auto_enrich && isEnrichmentActive ? (
                    <Button onClick={handlePauseEnrichment} variant="outline" size="sm" leftIcon={<PowerIcon size={12} />} className="h-8 text-xs">
                      Stop
                    </Button>
                  ) : !campaign.auto_enrich && !isEnrichmentActive && hasUnenrichedLeads ? (
                    <Button onClick={triggerEnrichment} variant="primary" size="sm" leftIcon={<LightningIcon size={12} />} className="h-8 text-xs">
                      Start Enrichment
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                {enrichActors.map((actorId) => {
                  const actor = getActorById(actorId);
                  return (
                    <div key={actorId} className="rounded-lg border border-line p-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-fg">{actor?.name || actorId}</p>
                        <p className="text-xs text-fg-secondary mt-0.5">{actor?.description || ""}</p>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-fg-secondary bg-muted">enrich</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {findActors.length === 0 && enrichActors.length === 0 && (
            <p className="text-sm text-fg-secondary py-4 text-center">
              No actors configured. Open Settings to add actors.
            </p>
          )}
        </div>
      </div>

      {/* ── Leads Table ── */}
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {/* Table toolbar */}
        <div className="px-4 py-3 border-b border-row flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              leftIcon={<MagnifyingGlassIcon size={14} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads..."
              className="h-8 py-1.5 w-52"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 py-1.5 w-auto"
            >
              <option value="">All Statuses</option>
              {[
                { label: "All Statuses", value: "all" },
                { label: "New", value: "new" },
                { label: "Enriching", value: "enriching" },
                { label: "Qualified", value: "qualified" },
                { label: "Disqualified", value: "disqualified" },
                { label: "Converted", value: "converted" },
              ].map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            {/* Column toggle */}
            {fields.length > 0 && (
              <div className="relative">
                <Button onClick={() => setShowColumnMenu((v) => !v)} variant="outline" size="sm" leftIcon={<SlidersHorizontalIcon size={13} />} className="h-8 text-xs text-fg-secondary">
                  Columns
                </Button>
                {showColumnMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowColumnMenu(false)} />
                    <div className="absolute left-0 top-full z-40 mt-1 w-48 bg-surface border border-line rounded-lg shadow-dropdown py-1.5">
                      <p className="px-3 py-1 text-xs font-medium text-fg-muted">Toggle columns</p>
                      {fields.map((f) => (
                        <label key={f._id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-fg hover:bg-muted cursor-pointer">
                          <input
                            type="checkbox"
                            checked={extraColumns.has(f._id)}
                            onChange={(e) => setExtraColumns((prev) => { const n = new Set(prev); if (e.target.checked) n.add(f._id); else n.delete(f._id); return n; })}
                            className="rounded"
                          />
                          {f.label}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <span className="text-xs text-fg-muted">{filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}</span>
            {unenrichedCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-fg-secondary">
                {isEnrichmentActive && <CircleNotchIcon size={10} className="animate-spin" />}
                {unenrichedCount} awaiting enrichment
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedLeads.size > 0 && (
              <Button onClick={handleImportToCRM} disabled={importing} variant="outline" size="sm" className="h-8 text-xs bg-success-surface text-success border-success hover:bg-success-surface">
                {importing ? <CircleNotchIcon size={11} className="animate-spin" /> : <ArrowRightIcon size={11} />}
                Import {selectedLeads.size} to CRM
              </Button>
            )}
            <Button onClick={handleExportCSV} variant="secondary" size="sm" leftIcon={<DownloadIcon size={12} />} className="h-8 text-xs">
              Export CSV
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-row">
                <th className="p-3 w-9">
                  <input type="checkbox" checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0} onChange={() => setSelectedLeads(selectedLeads.size === filteredLeads.length ? new Set() : new Set(filteredLeads.map((l) => l.id)))} className="rounded" />
                </th>
                <th className="p-3 text-xs font-medium text-fg-secondary whitespace-nowrap">Label</th>
                {fields.filter((f) => extraColumns.has(f._id)).map((f) => (
                  <th key={f._id} className="p-3 text-xs font-medium text-fg-secondary whitespace-nowrap">{f.label}</th>
                ))}
                <th className="p-3 text-xs font-medium text-fg-secondary whitespace-nowrap">Added</th>
                <th className="p-3 text-xs font-medium text-fg-secondary whitespace-nowrap">Score</th>
                <th className="p-3 text-xs font-medium text-fg-secondary whitespace-nowrap">Status</th>
                <th className="p-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6 + fields.filter((f) => extraColumns.has(f._id)).length} className="p-12 text-center text-sm text-fg-secondary">
                    {campaign.leads.length === 0
                      ? runningActor ? <span className="flex items-center justify-center gap-2"><CircleNotchIcon size={14} className="animate-spin" /> Discovery running — leads will appear here shortly</span>
                      : "No leads yet. Run a scraper from Discovery Configuration above."
                      : "No leads match your filters."}
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const status = displayStatus(lead);
                  const isRe = reEnrichingLeads.has(lead.id);
                  return (
                    <tr key={lead.id} className="border-b border-row hover:bg-muted transition-colors cursor-pointer" onClick={() => setDrawerLeadId(lead.id)}>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedLeads.has(lead.id)} onChange={() => setSelectedLeads((prev) => { const n = new Set(prev); if (n.has(lead.id)) n.delete(lead.id); else n.add(lead.id); return n; })} className="rounded" />
                      </td>
                      <td className="p-3 max-w-[200px]">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setDrawerLeadId(lead.id); }} className="text-sm font-medium text-fg hover:underline break-words line-clamp-2 text-left cursor-pointer">
                          {lead.display_name || "Unknown"}
                        </button>
                        {lead.email && <p className="text-xs text-fg-secondary flex items-center gap-1 mt-0.5"><EnvelopeIcon size={10} />{lead.email}</p>}
                        {lead.website && (
                          <p className="text-xs text-fg-secondary flex items-center gap-1 mt-0.5 truncate max-w-[180px]">
                            <GlobeIcon size={10} />
                            <a href={lead.website} target="_blank" rel="noopener noreferrer" className="hover:underline" onClick={(e) => e.stopPropagation()}>
                              {lead.website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                            </a>
                          </p>
                        )}
                      </td>
                      {fields.filter((f) => extraColumns.has(f._id)).map((f) => {
                        const { display, isUrl } = resolveFieldValue(lead, f);
                        return (
                          <td key={f._id} className="p-3 text-xs max-w-[160px]">
                            {isUrl && display !== "—" ? (
                              <a href={display} target="_blank" rel="noopener noreferrer" className="text-accent-strong hover:underline truncate block" onClick={(e) => e.stopPropagation()}>
                                {display.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                              </a>
                            ) : (
                              <span className="text-fg-secondary truncate block">{display}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-3 text-xs text-fg-secondary whitespace-nowrap">{formatRelativeTime(lead.created_at)}</td>
                      <td className="p-3">
                        {lead.status === "new" || lead.status === "enriching"
                          ? <span className="text-xs text-fg-muted">—</span>
                          : <ScoreBadge score={lead.score} />}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[status] || "text-fg-secondary bg-muted"}`}>
                          {status}
                        </span>
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        {isRe ? (
                          <CircleNotchIcon size={14} className="animate-spin text-fg-muted" />
                        ) : lead.status === "new" ? (
                          <div className="flex items-center gap-0.5">
                            <Button onClick={() => handleReEnrich(lead.id)} title="Enrich" variant="ghost" size="sm" className="p-1 h-auto">
                              <LightningIcon size={14} />
                            </Button>
                            <Button onClick={() => handleSkip(lead.id)} title="Skip enrichment" variant="ghost" size="sm" className="p-1 h-auto">
                              <ArrowRightIcon size={14} />
                            </Button>
                            <Button onClick={() => handleDeleteLead(lead.id)} title="Delete" variant="ghost" size="sm" className="p-1 h-auto text-fg-muted hover:text-danger hover:bg-danger-surface">
                              <TrashIcon size={13} />
                            </Button>
                          </div>
                        ) : (lead.status === "qualified" || lead.status === "converted" || lead.status === "disqualified" || lead.status === "declined") ? (
                          <div className="flex items-center gap-0.5">
                            <Button onClick={() => handleReEnrich(lead.id)} title="Re-enrich" variant="ghost" size="sm" className="p-1 h-auto">
                              <ArrowCounterClockwiseIcon size={14} />
                            </Button>
                            <Button onClick={() => handleDeleteLead(lead.id)} title="Delete" variant="ghost" size="sm" className="p-1 h-auto text-fg-muted hover:text-danger hover:bg-danger-surface">
                              <TrashIcon size={13} />
                            </Button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Run History ── */}
      {campaign.runs.length > 0 && (
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-divider">
            <h2 className="text-sm font-semibold text-fg">Run History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-row">
                  {["Actor", "Status", "Results", "Cost", "Started"].map((h) => (
                    <th key={h} className="p-3 text-xs font-medium text-fg-secondary">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaign.runs.slice(0, 5).map((run) => {
                  const actor = getActorById(run.actor_id);
                  return (
                    <tr key={run.id} className="border-b border-row">
                      <td className="p-3 text-sm text-fg">{actor?.name || run.actor_id}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${run.status === "succeeded" ? "text-success bg-success-surface" : run.status === "running" ? "text-warning bg-warning-surface" : "text-danger bg-danger-surface"}`}>
                          {run.status === "running" && <CircleNotchIcon size={10} className="animate-spin" />}
                          {run.status}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-fg-secondary">{run.result_count ?? "—"}</td>
                      <td className="p-3 text-sm text-fg-secondary">{run.cost_usd != null ? `$${run.cost_usd.toFixed(4)}` : "—"}</td>
                      <td className="p-3 text-xs text-fg-secondary">{new Date(run.started_at).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Settings Panel ── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSettings(false)} />
          <div className="relative ml-auto w-full max-w-xl bg-surface border-l border-line flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-divider shrink-0">
              <div>
                <h2 className="text-heading-md text-fg">Campaign Settings</h2>
                <p className="text-xs text-fg-secondary mt-0.5">Edit configuration for {campaign.name}</p>
              </div>
              <Button onClick={() => setShowSettings(false)} variant="ghost" size="sm" className="p-2">
                <XIcon size={16} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {editSettings && (
                <>
                  {/* Basic settings */}
                  <div className="space-y-4">
                    <Input label="Target Niche" value={editSettings.targetNiche} onChange={(e) => setEditSettings({ ...editSettings, targetNiche: e.target.value })} />
                    <div className="grid grid-cols-2 gap-3">
                      <Select label="AI Provider" value={editSettings.aiProvider} onChange={(e) => setEditSettings({ ...editSettings, aiProvider: e.target.value })}>{[{ label: "OpenRouter", value: "openrouter" }, { label: "Anthropic (Claude)", value: "anthropic" }, { label: "Ollama (Local)", value: "ollama" }].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
                      <Select label="Schedule" value={editSettings.scheduleFrequency} onChange={(e) => setEditSettings({ ...editSettings, scheduleFrequency: e.target.value })}>{[{ label: "Run Once", value: "once" }, { label: "Daily", value: "daily" }, { label: "Weekly", value: "weekly" }].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Select label="Lead Enrichment" value={editSettings.autoEnrich ? "automatic" : "off"} onChange={(e) => setEditSettings({ ...editSettings, autoEnrich: e.target.value === "automatic" })}>{[{ label: "Automatic", value: "automatic" }, { label: "Off", value: "off" }].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
                      <Input label="Enrichment Concurrency" type="number" min={1} value={editSettings.enrichmentConcurrency} onChange={(e) => setEditSettings({ ...editSettings, enrichmentConcurrency: e.target.value === "" ? "" : parseInt(e.target.value) || 1 })} placeholder="Default (1)" />
                    </div>
                  </div>

                  {/* Actors */}
                  <div className="border-t border-row pt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-fg">Actors</p>
                      {(() => {
                        const used = new Set(editSettings.actorOrder);
                        const avFind = getActorsByPhase("find").filter((a) => !used.has(a.id));
                        const avEnrich = getActorsByPhase("enrich").filter((a) => !used.has(a.id));
                        if (avFind.length === 0 && avEnrich.length === 0) return null;
                        return (
                          <div className="relative">
                            <Button onClick={() => setAddActorOpen((v) => !v)} variant="outline" size="sm" leftIcon={<PlusIcon size={12} />} className="h-7 text-xs text-fg-secondary">
                              Add Actor
                            </Button>
                            {addActorOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setAddActorOpen(false)} />
                                <div className="absolute right-0 top-full z-20 mt-1 w-64 bg-surface border border-line rounded-lg shadow-dropdown py-1.5">
                                  {avFind.length > 0 && (
                                    <>
                                      <p className="px-3 py-1 text-xs font-medium text-fg-muted">Scraping</p>
                                      {avFind.map((a) => (
                                        <button key={a.id} onClick={() => addActorToSettings(a.id)} className="flex w-full items-start gap-2 px-3 py-2 rounded text-left hover:bg-muted transition-colors">
                                          <div>
                                            <p className="text-sm font-medium text-fg">{a.name}</p>
                                            <p className="text-xs text-fg-secondary line-clamp-1">{a.description}</p>
                                          </div>
                                        </button>
                                      ))}
                                    </>
                                  )}
                                  {avEnrich.length > 0 && (
                                    <>
                                      {avFind.length > 0 && <div className="border-t border-row my-1" />}
                                      <p className="px-3 py-1 text-xs font-medium text-fg-muted">Enrichment</p>
                                      {avEnrich.map((a) => (
                                        <button key={a.id} onClick={() => addActorToSettings(a.id)} className="flex w-full items-start gap-2 px-3 py-2 rounded text-left hover:bg-muted transition-colors">
                                          <div>
                                            <p className="text-sm font-medium text-fg">{a.name}</p>
                                            <p className="text-xs text-fg-secondary line-clamp-1">{a.description}</p>
                                          </div>
                                        </button>
                                      ))}
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-fg-secondary">Drag the handle to reorder. Actors run top-to-bottom during discovery and enrichment.</p>
                    {editSettings.actorOrder.length === 0 ? (
                      <p className="text-sm text-fg-secondary py-4 text-center border border-dashed border-line rounded-lg">No actors. Click &quot;Add Actor&quot; to get started.</p>
                    ) : (
                      <SortableList
                        items={editSettings.actorOrder}
                        getId={(actorId) => actorId}
                        onReorder={(next) =>
                          setEditSettings((prev) => prev ? { ...prev, actorOrder: next } : prev)
                        }
                        className="space-y-2"
                        renderItem={(actorId) => {
                          const def = getActorById(actorId);
                          if (!def) return null;
                          const isCollapsed = collapsedActors.has(actorId);
                          const hasFields = def.phase !== "enrich" && Object.keys(def.inputFieldDescriptions || {}).length > 0;
                          const fieldVals = editSettings.actorConfigs[actorId] || {};
                          return (
                            <div className="rounded-lg border border-line">
                              <div className="flex items-center">
                                <button onClick={() => setCollapsedActors((prev) => { const n = new Set(prev); if (n.has(actorId)) n.delete(actorId); else n.add(actorId); return n; })} className="flex-1 flex items-center justify-between p-3 text-left hover:bg-muted transition-colors min-w-0">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-fg">{def.name}</span>
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-fg-secondary bg-muted border border-line capitalize">{def.phase}</span>
                                    </div>
                                    <p className="text-xs text-fg-secondary mt-0.5 truncate">{def.description}</p>
                                  </div>
                                  {isCollapsed ? <CaretRightIcon size={14} className="shrink-0 text-fg-muted" /> : <ChevronDownIcon size={14} className="shrink-0 text-fg-muted" />}
                                </button>
                                <Button onClick={() => removeActorFromSettings(actorId)} variant="ghost" size="sm" className="p-2 mr-1 h-auto text-fg-muted hover:text-danger hover:bg-danger-surface" title="Remove actor">
                                  <XIcon size={14} />
                                </Button>
                              </div>
                              {!isCollapsed && (
                                <div className="border-t border-row px-4 py-3">
                                  {hasFields ? (
                                    <div className="space-y-3">
                                      {Object.keys(def.inputFieldDescriptions || {}).map((fieldName) => {
                                        const desc = def.inputFieldDescriptions?.[fieldName];
                                        const val = fieldVals[fieldName] || "";
                                        return (
                                          <div key={fieldName}>
                                            {desc?.type === "string-array" ? (
                                              <Textarea
                                                label={desc?.label || fieldName}
                                                value={val}
                                                onChange={(e) => {
                                                  const upd = { ...editSettings };
                                                  if (!upd.actorConfigs[actorId]) upd.actorConfigs[actorId] = {};
                                                  upd.actorConfigs[actorId][fieldName] = e.target.value;
                                                  setEditSettings({ ...upd });
                                                }}
                                                placeholder={desc?.placeholder}
                                                rows={3}
                                              />
                                            ) : (
                                              <Input
                                                label={desc?.label || fieldName}
                                                type={desc?.type === "number" ? "number" : "text"}
                                                value={val}
                                                onChange={(e) => {
                                                  const upd = { ...editSettings };
                                                  if (!upd.actorConfigs[actorId]) upd.actorConfigs[actorId] = {};
                                                  upd.actorConfigs[actorId][fieldName] = e.target.value;
                                                  setEditSettings({ ...upd });
                                                }}
                                                placeholder={desc?.placeholder}
                                                className="h-8"
                                              />
                                            )}
                                            {desc?.helpText && <p className="text-xs text-fg-secondary mt-1">{desc.helpText}</p>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-fg-secondary">No configurable fields — inputs filled from lead data during enrichment.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }}
                      />
                    )}
                  </div>

                  {/* Lead Data Fields */}
                  <div className="border-t border-row pt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TagIcon size={14} className="text-fg-secondary" />
                        <p className="text-sm font-semibold text-fg">Lead Data Fields</p>
                      </div>
                      <Button onClick={() => setEditLeadFields((prev) => [...prev, { id: `field_${Date.now()}`, label: "", type: "text" }])} variant="outline" size="sm" leftIcon={<PlusIcon size={12} />} className="h-7 text-xs text-fg-secondary">
                        Add
                      </Button>
                    </div>
                    <p className="text-xs text-fg-secondary">Fields extracted from each lead during enrichment.</p>
                    {editLeadFields.length === 0 ? (
                      <p className="text-sm text-fg-secondary py-3 text-center border border-dashed border-line rounded-lg">No custom fields. Click &quot;Add&quot; to track extra data per lead.</p>
                    ) : (
                      <div className="space-y-2">
                        {editLeadFields.map((f) => (
                          <div key={f.id} className="rounded-lg border border-line p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <div className="flex-1 space-y-1.5 min-w-0">
                                <Input value={f.label} onChange={(e) => setEditLeadFields((prev) => prev.map((x) => x.id === f.id ? { ...x, label: e.target.value } : x))} placeholder="Field label" className="h-8 font-medium" />
                                <Input value={f.description || ""} onChange={(e) => setEditLeadFields((prev) => prev.map((x) => x.id === f.id ? { ...x, description: e.target.value } : x))} placeholder="Description (optional)" className="h-7 text-xs" />
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {[{ type: "text" as const, icon: <TextTIcon size={11} />, title: "Text" }, { type: "number" as const, icon: <HashIcon size={11} />, title: "Number" }, { type: "boolean" as const, icon: <ToggleRightIcon size={11} />, title: "Yes/No" }, { type: "url" as const, icon: <LinkIcon size={11} />, title: "URL" }].map(({ type, icon, title }) => (
                                  <Button key={type} onClick={() => setEditLeadFields((prev) => prev.map((x) => x.id === f.id ? { ...x, type } : x))} title={title} variant={f.type === type ? "primary" : "outline"} size="sm" className="h-7 w-7 px-0">
                                    {icon}
                                  </Button>
                                ))}
                                <Button onClick={() => setEditLeadFields((prev) => prev.filter((x) => x.id !== f.id))} variant="ghost" size="sm" className="h-7 w-7 px-0 text-fg-muted hover:text-danger hover:bg-danger-surface">
                                  <XIcon size={13} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* KPIs */}
                  <div className="border-t border-row pt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BarChartIcon size={14} className="text-fg-secondary" />
                        <p className="text-sm font-semibold text-fg">Tracked KPIs</p>
                      </div>
                      <Button onClick={() => setEditKpis((prev) => [...prev, { id: `kpi_${Date.now()}`, label: "", type: "boolean" }])} variant="outline" size="sm" leftIcon={<PlusIcon size={12} />} className="h-7 text-xs text-fg-secondary">
                        Add
                      </Button>
                    </div>
                    <p className="text-xs text-fg-secondary">KPIs automatically filled by AI during enrichment.</p>
                    {editKpis.length === 0 ? (
                      <p className="text-sm text-fg-secondary py-3 text-center border border-dashed border-line rounded-lg">No KPIs configured. Click &quot;Add&quot; to track custom metrics.</p>
                    ) : (
                      <div className="space-y-2">
                        {editKpis.map((k) => (
                          <div key={k.id} className="rounded-lg border border-line p-3">
                            <div className="flex items-start gap-2">
                              <div className="flex-1 space-y-1.5 min-w-0">
                                <Input value={k.label} onChange={(e) => setEditKpis((prev) => prev.map((x) => x.id === k.id ? { ...x, label: e.target.value } : x))} placeholder="KPI label" className="h-8 font-medium" />
                                <Input value={k.description || ""} onChange={(e) => setEditKpis((prev) => prev.map((x) => x.id === k.id ? { ...x, description: e.target.value } : x))} placeholder="Description (optional)" className="h-7 text-xs" />
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {[{ type: "boolean" as const, label: "Yes/No", icon: <ToggleLeftIcon size={11} /> }, { type: "text" as const, label: "Text", icon: <TextTIcon size={11} /> }].map(({ type, label, icon }) => (
                                  <Button key={type} onClick={() => setEditKpis((prev) => prev.map((x) => x.id === k.id ? { ...x, type } : x))} variant={k.type === type ? "primary" : "outline"} size="sm" className="h-7 px-2 text-xs">
                                    {icon} {label}
                                  </Button>
                                ))}
                                <Button onClick={() => setEditKpis((prev) => prev.filter((x) => x.id !== k.id))} variant="ghost" size="sm" className="h-7 w-7 px-0 text-fg-muted hover:text-danger hover:bg-danger-surface">
                                  <XIcon size={13} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 px-4 py-3 border-t border-divider bg-subtle shrink-0">
              <Button onClick={() => setShowSettings(false)} variant="secondary" size="sm">Cancel</Button>
              <Button onClick={handleSaveSettings} disabled={savingSettings} variant="primary" size="sm">
                {savingSettings ? <span className="flex items-center gap-2"><CircleNotchIcon size={14} className="animate-spin" /> Saving...</span> : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Campaign Modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-surface border border-line rounded-lg shadow-modal p-4 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-fg mb-2">Delete Campaign</h3>
            <p className="text-sm text-fg-secondary mb-5">
              This will permanently delete <span className="font-medium text-fg">{campaign.name}</span> and all its leads. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button onClick={() => setShowDeleteConfirm(false)} variant="secondary" size="sm">Cancel</Button>
              <Button onClick={handleDeleteCampaign} disabled={deleting} variant="primary" size="sm" className="bg-danger text-on-inverse hover:opacity-90">
                {deleting ? "Deleting..." : "Delete Campaign"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clear Leads Modal ── */}
      {showClearLeadsConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowClearLeadsConfirm(false)} />
          <div className="relative bg-surface border border-line rounded-lg shadow-modal p-4 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-fg mb-2">Delete All Leads</h3>
            <p className="text-sm text-fg-secondary mb-5">
              This will permanently delete all <span className="font-medium text-fg">{campaign.leads.length} leads</span>. The campaign will remain. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button onClick={() => setShowClearLeadsConfirm(false)} variant="secondary" size="sm">Cancel</Button>
              <Button onClick={handleClearLeads} disabled={clearingLeads} variant="primary" size="sm" className="bg-danger text-on-inverse hover:opacity-90">
                {clearingLeads ? "Deleting..." : "Delete All Leads"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <LeadDetailDrawer
        open={!!drawerLeadId}
        onClose={() => { setDrawerLeadId(null); fetchNow(); }}
        leadId={drawerLeadId}
        campaignId={id as string}
      />
    </div>
  );
}
