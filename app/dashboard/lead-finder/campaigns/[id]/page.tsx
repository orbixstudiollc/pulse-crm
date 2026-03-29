"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  ClockIcon,
  TrashIcon,
  DownloadIcon,
  DotsThreeIcon,
  MagnifyingGlassIcon,
  TargetIcon,
  GearIcon,
  LightningIcon,
  ArrowRightIcon,
  EnvelopeIcon,
  GlobeIcon,
} from "@/components/ui";
import { ScoreBadge } from "@/components/lead-finder/ScoreBadge";
import { useLeadEvents } from "@/hooks/use-lead-events";

// ── Types ──────────────────────────────────────────────────────────────────

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
    summary?: string;
  } | null;
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
  kpi_definitions: { key: string; label: string; type: string }[];
  lead_field_definitions: { key: string; label: string; source: string }[];
  leads: Lead[];
  runs: { id: string; actor_id: string; status: string; cost_usd: number; started_at: string }[];
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

// ── Status styles ──────────────────────────────────────────────────────────

const LEAD_STATUS_STYLES: Record<string, string> = {
  new: "text-blue-700 dark:text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30",
  enriching: "text-amber-700 dark:text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30",
  enriched: "text-green-700 dark:text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30",
  qualified: "text-green-700 dark:text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30",
  disqualified: "text-red-700 dark:text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30",
  converted: "text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30",
  error: "text-red-700 dark:text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30",
};

const CAMPAIGN_STATUS_STYLES: Record<string, string> = {
  draft: "text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800",
  active: "text-green-700 dark:text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30",
  paused: "text-amber-700 dark:text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30",
  completed: "text-blue-700 dark:text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function StatusBadge({ status, styles }: { status: string; styles: Record<string, string> }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] || "text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800"}`}
    >
      {status}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size: number; className?: string }>;
  color?: string;
}) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
      <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 mb-2">
        <Icon size={14} />
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color || "text-white"}`}>{value}</p>
    </div>
  );
}

// ── Action dropdown for individual leads ───────────────────────────────────

function LeadActionMenu({
  lead,
  onEnrich,
  onChangeStatus,
  onDelete,
  onViewDetail,
}: {
  lead: Lead;
  onEnrich: (id: string) => void;
  onChangeStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onViewDetail: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-1 rounded text-neutral-500 dark:text-neutral-400 hover:text-white hover:bg-neutral-100 dark:bg-neutral-800 transition-colors"
      >
        <DotsThreeIcon size={16} weight="bold" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-44 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl py-1">
            <button
              onClick={() => {
                onViewDetail(lead.id);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 hover:text-white hover:bg-neutral-100 dark:bg-neutral-800 transition-colors"
            >
              View Details
            </button>
            <button
              onClick={() => {
                onEnrich(lead.id);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 hover:text-white hover:bg-neutral-100 dark:bg-neutral-800 transition-colors"
            >
              Enrich Lead
            </button>
            <div className="border-t border-neutral-200 dark:border-neutral-800 my-1" />
            {["qualified", "disqualified", "converted"].map((s) => (
              <button
                key={s}
                onClick={() => {
                  onChangeStatus(lead.id, s);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 hover:text-white hover:bg-neutral-100 dark:bg-neutral-800 transition-colors capitalize"
              >
                Mark as {s}
              </button>
            ))}
            <div className="border-t border-neutral-200 dark:border-neutral-800 my-1" />
            <button
              onClick={() => {
                onDelete(lead.id);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-400/10 transition-colors"
            >
              Delete Lead
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Settings panel ─────────────────────────────────────────────────────────

function SettingsPanel({
  campaign,
  onClose,
  onUpdate,
}: {
  campaign: Campaign;
  onClose: () => void;
  onUpdate: (updates: Record<string, unknown>) => void;
}) {
  const [autoEnrich, setAutoEnrich] = useState(campaign.auto_enrich);
  const [schedule, setSchedule] = useState(campaign.schedule_frequency);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate({ auto_enrich: autoEnrich, schedule_frequency: schedule });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">Campaign Settings</h3>
          <button onClick={onClose} className="text-neutral-500 dark:text-neutral-400 hover:text-white">
            <XCircleIcon size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">Schedule</label>
            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-950 dark:text-neutral-50 text-sm focus:outline-none focus:border-[#444]"
            >
              <option value="once">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">Auto-Enrich</label>
            <button
              onClick={() => setAutoEnrich(!autoEnrich)}
              className={`w-full px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                autoEnrich
                  ? "bg-emerald-400/10 text-green-600 dark:text-green-600 dark:text-green-400 border-emerald-400/20"
                  : "bg-neutral-50 dark:bg-neutral-950 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800"
              }`}
            >
              {autoEnrich ? "Enabled" : "Disabled"}
            </button>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">AI Provider</label>
            <p className="text-sm text-neutral-950 dark:text-neutral-50 capitalize">{campaign.ai_provider}</p>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">Actors ({campaign.apify_actors.length})</label>
            <div className="flex flex-wrap gap-1">
              {campaign.apify_actors.map((a) => (
                <span key={a} className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-950 dark:text-neutral-50">
                  {a}
                </span>
              ))}
              {campaign.apify_actors.length === 0 && (
                <span className="text-xs text-neutral-500 dark:text-neutral-400">No actors configured</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-sm font-medium hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [enrichingAll, setEnrichingAll] = useState(false);
  const [enrichingLead, setEnrichingLead] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Selection for bulk actions
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  // Discovery/enrichment progress
  const [discoveryProgress, setDiscoveryProgress] = useState<{ current: number; total: number } | null>(null);
  const [enrichmentProgress, setEnrichmentProgress] = useState<{ completed: number; total: number } | null>(null);

  // Search & filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // ── Fetch campaign ─────────────────────────────────────────────────────

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await fetch(`/api/lead-finder/campaigns/${id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setCampaign(json.data);
      setLeads(json.data.leads ?? []);
    } catch {
      toast.error("Failed to load campaign");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  // ── SSE real-time events ───────────────────────────────────────────────

  useLeadEvents({
    campaignId: id,
    enabled: !!campaign,
    onLeadDiscovered: (data) => {
      const d = data as Record<string, unknown>;
      const newLead: Lead = {
        id: d.leadId as string,
        campaign_id: d.campaignId as string,
        display_name: (d.displayName as string) || null,
        email: (d.email as string) || null,
        phone: (d.phone as string) || null,
        website: (d.website as string) || null,
        score: 0,
        status: (d.status as string) || "new",
        source: (d.source as string) || "unknown",
        raw_data: (d.rawData as Record<string, unknown>) || null,
        mapped_data: (d.mappedData as Record<string, unknown>) || null,
        llm_cost_usd: 0,
        created_at: (d.createdAt as string) || new Date().toISOString(),
      };
      setLeads((prev) => [newLead, ...prev]);
      setDiscoveryProgress({
        current: (d.index as number) || 0,
        total: (d.totalItems as number) || 0,
      });
    },
    onLeadEnrichmentCompleted: (data) => {
      const d = data as Record<string, unknown>;
      setLeads((prev) =>
        prev.map((l) =>
          l.id === d.leadId
            ? { ...l, score: (d.score as number) || 0, status: (d.status as string) || l.status }
            : l
        )
      );
    },
    onLeadKpiUpdated: (data) => {
      const d = data as Record<string, unknown>;
      setLeads((prev) =>
        prev.map((l) =>
          l.id === d.leadId
            ? {
                ...l,
                personalization: {
                  ...l.personalization,
                  campaign_kpis: d.kpis as Record<string, boolean | string>,
                },
              }
            : l
        )
      );
    },
    onLeadStatusChanged: (data) => {
      const d = data as Record<string, unknown>;
      setLeads((prev) =>
        prev.map((l) => (l.id === d.leadId ? { ...l, status: d.newStatus as string } : l))
      );
    },
    onDiscoveryStarted: () => {
      setDiscovering(true);
      setDiscoveryProgress({ current: 0, total: 0 });
    },
    onDiscoveryCompleted: (data) => {
      const d = data as Record<string, unknown>;
      setDiscovering(false);
      setDiscoveryProgress(null);
      toast.success(
        `Discovery complete: ${d.totalInserted} leads found, ${d.totalDeduplicated} duplicates skipped`
      );
      fetchCampaign();
    },
    onEnrichmentProgress: (data) => {
      const d = data as Record<string, unknown>;
      setEnrichmentProgress({
        completed: (d.completed as number) || 0,
        total: (d.total as number) || 0,
      });
      if ((d.completed as number) >= (d.total as number)) {
        setEnrichingAll(false);
        setEnrichmentProgress(null);
        toast.success("Enrichment complete");
        fetchCampaign();
      }
    },
  });

  // ── Actions ────────────────────────────────────────────────────────────

  const handleActivatePause = async () => {
    if (!campaign) return;
    const newStatus = campaign.status === "active" ? "paused" : "active";
    try {
      const res = await fetch(`/api/lead-finder/campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setCampaign((prev) => (prev ? { ...prev, status: newStatus } : null));
      toast.success(`Campaign ${newStatus === "active" ? "activated" : "paused"}`);
    } catch {
      toast.error("Failed to update campaign status");
    }
  };

  const handleRunDiscovery = async () => {
    setDiscovering(true);
    try {
      const res = await fetch(`/api/lead-finder/campaigns/${id}/discover`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Discovery failed");
      }
      toast.success("Discovery started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Discovery failed");
      setDiscovering(false);
    }
  };

  const handleEnrichAll = async () => {
    setEnrichingAll(true);
    try {
      const res = await fetch(`/api/lead-finder/campaigns/${id}/enrich`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Enrichment failed");
      }
      toast.success("Enrichment started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enrichment failed");
      setEnrichingAll(false);
    }
  };

  const handleEnrichLead = async (leadId: string) => {
    setEnrichingLead(leadId);
    try {
      const res = await fetch(`/api/lead-finder/leads/${leadId}/enrich`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to enrich lead");
      toast.success("Lead enrichment started");
    } catch {
      toast.error("Failed to enrich lead");
    } finally {
      setEnrichingLead(null);
    }
  };

  const handleChangeStatus = async (leadId: string, status: string) => {
    try {
      const res = await fetch(`/api/lead-finder/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
      toast.success(`Lead marked as ${status}`);
    } catch {
      toast.error("Failed to update lead status");
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      const res = await fetch(`/api/lead-finder/leads/${leadId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      setSelectedLeads((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
      toast.success("Lead deleted");
    } catch {
      toast.error("Failed to delete lead");
    }
  };

  const handleImportToCRM = async () => {
    const ids = Array.from(selectedLeads);
    if (ids.length === 0) {
      toast.error("Select leads to import");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/lead-finder/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", leadIds: ids }),
      });
      if (!res.ok) throw new Error("Import failed");
      toast.success(`${ids.length} lead(s) imported to CRM`);
      setSelectedLeads(new Set());
      fetchCampaign();
    } catch {
      toast.error("Failed to import leads");
    } finally {
      setImporting(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await fetch(`/api/lead-finder/leads?campaignId=${id}&limit=10000&offset=0`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      const csvLeads = json.data || [];
      if (csvLeads.length === 0) {
        toast.error("No leads to export");
        return;
      }

      const headers = ["Name", "Email", "Phone", "Website", "Score", "Status", "Source", "Created"];
      const rows = csvLeads.map((l: Lead) => [
        l.display_name || "",
        l.email || "",
        l.phone || "",
        l.website || "",
        l.score,
        l.status,
        l.source,
        l.created_at,
      ]);

      const csv = [headers.join(","), ...rows.map((r: (string | number)[]) => r.map((c) => `"${c}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${campaign?.name || "leads"}-export.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch {
      toast.error("Failed to export CSV");
    }
  };

  const handleUpdateCampaign = async (updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/lead-finder/campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Campaign updated");
      fetchCampaign();
    } catch {
      toast.error("Failed to update campaign");
    }
  };

  // ── Selection helpers ──────────────────────────────────────────────────

  const toggleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Filtered leads ─────────────────────────────────────────────────────

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (statusFilter !== "all") {
      result = result.filter((l) => l.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.display_name?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.website?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [leads, statusFilter, search]);

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <CircleNotchIcon size={32} className="animate-spin text-neutral-500 dark:text-neutral-400" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center">
        <p className="text-neutral-500 dark:text-neutral-400 mb-4">Campaign not found</p>
        <Link href="/dashboard/lead-finder/campaigns" className="text-white text-sm underline">
          Back to campaigns
        </Link>
      </div>
    );
  }

  const stats = campaign.stats;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/lead-finder/campaigns"
            className="p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeftIcon size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-neutral-950 dark:text-neutral-50">{campaign.name}</h1>
              <StatusBadge status={campaign.status} styles={CAMPAIGN_STATUS_STYLES} />
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{campaign.target_niche}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-white transition-colors"
            title="Settings"
          >
            <GearIcon size={16} />
          </button>
          <button
            onClick={handleActivatePause}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              campaign.status === "active"
                ? "bg-amber-400/10 text-amber-600 dark:text-amber-400 border border-amber-400/20 hover:bg-amber-400/20"
                : "bg-emerald-400/10 text-green-600 dark:text-green-600 dark:text-green-400 border border-emerald-400/20 hover:bg-emerald-400/20"
            }`}
          >
            {campaign.status === "active" ? (
              <>
                <PauseIcon size={14} /> Pause
              </>
            ) : (
              <>
                <PlayIcon size={14} /> Activate
              </>
            )}
          </button>
          <button
            onClick={handleRunDiscovery}
            disabled={discovering}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50 text-sm font-medium hover:bg-[#2a2a30] disabled:opacity-50 transition-colors"
          >
            {discovering ? (
              <CircleNotchIcon size={14} className="animate-spin" />
            ) : (
              <LightningIcon size={14} />
            )}
            Run Discovery
          </button>
          <button
            onClick={handleEnrichAll}
            disabled={enrichingAll || leads.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-50 transition-colors"
          >
            {enrichingAll ? (
              <CircleNotchIcon size={14} className="animate-spin" />
            ) : (
              <SparkleIcon size={14} />
            )}
            Enrich All
          </button>
        </div>
      </div>

      {/* Progress indicators */}
      {discoveryProgress && (
        <div className="mb-4 p-3 rounded-lg bg-blue-400/5 border border-blue-400/20">
          <div className="flex items-center gap-2 mb-2">
            <CircleNotchIcon size={14} className="animate-spin text-blue-600 dark:text-blue-400" />
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              Discovering leads... {discoveryProgress.current}/{discoveryProgress.total || "?"}
            </span>
          </div>
          {discoveryProgress.total > 0 && (
            <div className="h-1 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, (discoveryProgress.current / discoveryProgress.total) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {enrichmentProgress && (
        <div className="mb-4 p-3 rounded-lg bg-purple-400/5 border border-purple-400/20">
          <div className="flex items-center gap-2 mb-2">
            <CircleNotchIcon size={14} className="animate-spin text-violet-600 dark:text-violet-400" />
            <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">
              Enriching leads... {enrichmentProgress.completed}/{enrichmentProgress.total}
            </span>
          </div>
          <div className="h-1 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-purple-400 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (enrichmentProgress.completed / enrichmentProgress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Leads" value={stats.totalLeads} icon={UsersIcon} />
        <StatCard
          label="Enriched"
          value={stats.enrichedLeads}
          icon={SparkleIcon}
          color="text-green-600 dark:text-green-600 dark:text-green-400"
        />
        <StatCard
          label="Avg Score"
          value={stats.avgScore}
          icon={ChartBarIcon}
          color={
            stats.avgScore >= 70
              ? "text-green-600 dark:text-green-600 dark:text-green-400"
              : stats.avgScore >= 40
                ? "text-amber-600 dark:text-amber-400"
                : "text-white"
          }
        />
        <StatCard
          label="Total Cost"
          value={`$${stats.totalCost.toFixed(4)}`}
          icon={CurrencyDollarIcon}
        />
      </div>

      {/* Filter bar + bulk actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads..."
              className="pl-8 pr-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-950 dark:text-neutral-50 text-sm placeholder:text-[#555] focus:outline-none focus:border-[#444] w-64"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-950 dark:text-neutral-50 text-sm focus:outline-none focus:border-[#444]"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="enriching">Enriching</option>
            <option value="enriched">Enriched</option>
            <option value="qualified">Qualified</option>
            <option value="disqualified">Disqualified</option>
            <option value="converted">Converted</option>
          </select>

          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Bulk actions */}
        <div className="flex items-center gap-2">
          {selectedLeads.size > 0 && (
            <button
              onClick={handleImportToCRM}
              disabled={importing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-400/10 text-green-600 dark:text-green-600 dark:text-green-400 border border-emerald-400/20 text-xs font-medium hover:bg-emerald-400/20 transition-colors"
            >
              {importing ? (
                <CircleNotchIcon size={12} className="animate-spin" />
              ) : (
                <ArrowRightIcon size={12} />
              )}
              Import {selectedLeads.size} to CRM
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-white text-xs font-medium transition-colors"
          >
            <DownloadIcon size={12} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Leads table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-[#444] bg-neutral-50 dark:bg-neutral-950 text-neutral-950 dark:text-neutral-50"
                  />
                </th>
                <th className="p-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="p-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="p-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Website
                </th>
                <th className="p-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Score
                </th>
                <th className="p-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="p-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Source
                </th>
                {/* Dynamic field columns */}
                {(campaign.lead_field_definitions || []).slice(0, 3).map((f) => (
                  <th
                    key={f.key}
                    className="p-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider"
                  >
                    {f.label}
                  </th>
                ))}
                {/* KPI columns */}
                {(campaign.kpi_definitions || []).slice(0, 3).map((k) => (
                  <th
                    key={k.key}
                    className="p-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider"
                  >
                    {k.label}
                  </th>
                ))}
                <th className="p-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      7 +
                      (campaign.lead_field_definitions || []).slice(0, 3).length +
                      (campaign.kpi_definitions || []).slice(0, 3).length +
                      1
                    }
                    className="p-12 text-center text-sm text-neutral-500 dark:text-neutral-400"
                  >
                    {leads.length === 0
                      ? "No leads yet. Run discovery to find leads."
                      : "No leads match your filters."}
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-neutral-200 dark:border-neutral-800/50 hover:bg-white dark:bg-neutral-800 transition-colors cursor-pointer"
                    onClick={() =>
                      router.push(`/dashboard/lead-finder/leads/${lead.id}`)
                    }
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedLeads.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        className="rounded border-[#444] bg-neutral-50 dark:bg-neutral-950"
                      />
                    </td>
                    <td className="p-3">
                      <span className="text-sm text-neutral-950 dark:text-neutral-50 font-medium">
                        {lead.display_name || "Unknown"}
                      </span>
                    </td>
                    <td className="p-3">
                      {lead.email ? (
                        <span className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                          <EnvelopeIcon size={12} />
                          {lead.email}
                        </span>
                      ) : (
                        <span className="text-xs text-[#555]">--</span>
                      )}
                    </td>
                    <td className="p-3">
                      {lead.website ? (
                        <span className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                          <GlobeIcon size={12} />
                          <span className="truncate max-w-[150px]">{lead.website}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-[#555]">--</span>
                      )}
                    </td>
                    <td className="p-3">
                      <ScoreBadge score={lead.score} />
                    </td>
                    <td className="p-3">
                      <StatusBadge status={lead.status} styles={LEAD_STATUS_STYLES} />
                    </td>
                    <td className="p-3">
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">
                        {lead.source?.replace(/_/g, " ") || "--"}
                      </span>
                    </td>
                    {/* Dynamic field values */}
                    {(campaign.lead_field_definitions || []).slice(0, 3).map((f) => (
                      <td key={f.key} className="p-3">
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {(lead.mapped_data as Record<string, unknown>)?.[f.key]
                            ? String((lead.mapped_data as Record<string, unknown>)[f.key])
                            : "--"}
                        </span>
                      </td>
                    ))}
                    {/* KPI values */}
                    {(campaign.kpi_definitions || []).slice(0, 3).map((k) => {
                      const kpiVal = lead.personalization?.campaign_kpis?.[k.key];
                      return (
                        <td key={k.key} className="p-3">
                          {kpiVal === true ? (
                            <CheckCircleIcon size={14} className="text-green-600 dark:text-green-600 dark:text-green-400" />
                          ) : kpiVal === false ? (
                            <XCircleIcon size={14} className="text-red-600 dark:text-red-400" />
                          ) : kpiVal ? (
                            <span className="text-xs text-neutral-500 dark:text-neutral-400">{String(kpiVal)}</span>
                          ) : (
                            <span className="text-xs text-[#555]">--</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <LeadActionMenu
                        lead={lead}
                        onEnrich={handleEnrichLead}
                        onChangeStatus={handleChangeStatus}
                        onDelete={handleDeleteLead}
                        onViewDetail={(lid) =>
                          router.push(`/dashboard/lead-finder/leads/${lid}`)
                        }
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel
          campaign={campaign}
          onClose={() => setShowSettings(false)}
          onUpdate={handleUpdateCampaign}
        />
      )}
    </div>
  );
}
