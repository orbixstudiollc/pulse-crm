"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  MagnifyingGlassIcon,
  TrashIcon,
  ArrowRightIcon,
  CircleNotchIcon,
  SparkleIcon,
  EnvelopeIcon,
  DownloadIcon,
  XIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ArrowSquareOutIcon,
  FunnelIcon,
  TargetIcon,
  UsersIcon,
  Input,
  Select,
  Button,
} from "@/components/ui";
import { LeadFinderSubNav } from "@/components/lead-finder/SubNav";
import { ScoreBadge } from "@/components/lead-finder/ScoreBadge";
import { getLeadDisplayName, formatSource, formatCost } from "@/lib/lead-finder/utils/lead-display";
import type { LFLead } from "@/lib/lead-finder/types";

// ── Types ──────────────────────────────────────────────────────────────────

interface LeadFieldDefinition {
  id: string;
  label: string;
  type: "text" | "number" | "boolean" | "url";
  description?: string;
}

interface Campaign {
  id: string;
  name: string;
  leadFieldDefinitions?: LeadFieldDefinition[];
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
  apify_cost_usd: number;
  created_at: string;
}

interface LeadFilter {
  id: string;
  field: string;
  operator: string;
  value: string | number | boolean;
  label: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  "new",
  "enriching",
  "enriched",
  "qualified",
  "disqualified",
  "converted",
  "error",
] as const;

const LEAD_STATUS_STYLES: Record<string, string> = {
  new: "text-blue-400 bg-blue-400/10",
  enriching: "text-amber-400 bg-amber-400/10",
  enriched: "text-green-400 bg-green-400/10",
  qualified: "text-green-400 bg-green-400/10",
  disqualified: "text-red-400 bg-red-400/10",
  converted: "text-violet-400 bg-violet-400/10",
  declined: "text-red-400 bg-red-400/10",
  archived: "text-neutral-400 bg-neutral-400/10",
  error: "text-red-400 bg-red-400/10",
};

const PAGE_SIZES = [25, 50, 100] as const;

// ── Helpers ───────────────────────────────────────────────────────────────

function resolveFieldValue(lead: Lead, field: string): unknown {
  const coreVal = lead[field as keyof Lead];
  if (coreVal !== undefined && coreVal !== null) return coreVal;
  if (lead.mapped_data?.[field] !== undefined) return lead.mapped_data[field];
  if (lead.raw_data?.[field] !== undefined) return lead.raw_data[field];
  return null;
}

function formatFieldValue(value: unknown, type?: string): string {
  if (value == null) return "\u2014";
  if (type === "boolean")
    return value === true || value === "true"
      ? "Yes"
      : value === false || value === "false"
        ? "No"
        : String(value);
  if (type === "number" && typeof value === "number")
    return value.toLocaleString();
  if (type === "url" && typeof value === "string" && value.startsWith("http"))
    return value;
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      if (value.length === 0) return "\u2014";
      if (value.every((v) => typeof v !== "object" || v === null))
        return value.filter((v) => v != null).join(", ");
      return value
        .map((item) => {
          if (typeof item !== "object" || item === null) return String(item);
          return Object.values(item as Record<string, unknown>)
            .filter((v) => v != null)
            .map(String)
            .join(": ");
        })
        .join(", ");
    }
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }
  return String(value);
}

function matchesFilter(lead: Lead, filter: LeadFilter): boolean {
  const raw = resolveFieldValue(lead, filter.field);
  const val = raw == null ? "" : raw;
  switch (filter.operator) {
    case "eq":
      return String(val).toLowerCase() === String(filter.value).toLowerCase();
    case "neq":
      return String(val).toLowerCase() !== String(filter.value).toLowerCase();
    case "gt":
      return Number(val) > Number(filter.value);
    case "gte":
      return Number(val) >= Number(filter.value);
    case "lt":
      return Number(val) < Number(filter.value);
    case "lte":
      return Number(val) <= Number(filter.value);
    case "contains":
      return String(val)
        .toLowerCase()
        .includes(String(filter.value).toLowerCase());
    case "not_contains":
      return !String(val)
        .toLowerCase()
        .includes(String(filter.value).toLowerCase());
    case "exists":
      return raw != null && String(raw).trim() !== "";
    case "not_exists":
      return raw == null || String(raw).trim() === "";
    case "starts_with":
      return String(val)
        .toLowerCase()
        .startsWith(String(filter.value).toLowerCase());
    case "ends_with":
      return String(val)
        .toLowerCase()
        .endsWith(String(filter.value).toLowerCase());
    default:
      return true;
  }
}

function applyFilters(leads: Lead[], filters: LeadFilter[]): Lead[] {
  if (filters.length === 0) return leads;
  return leads.filter((lead) => filters.every((f) => matchesFilter(lead, f)));
}

function generateCsv(leads: Lead[], dynFields: LeadFieldDefinition[]): string {
  const headers = [
    "ID",
    "Display Name",
    ...dynFields.map((f) => f.label),
    "Score",
    "Status",
    "Email",
    "Phone",
    "Website",
    "Source",
    "Cost",
    "Created",
  ];
  const escape = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n")
      ? `"${v.replace(/"/g, '""')}"`
      : v;
  const rows = leads.map((lead) => {
    const dn = lead.display_name || lead.email || lead.website || "Unknown";
    const values = [
      String(lead.id),
      dn,
      ...dynFields.map((f) =>
        formatFieldValue(resolveFieldValue(lead, f.id), f.type)
      ),
      String(lead.score ?? 0),
      lead.status,
      lead.email || "",
      lead.phone || "",
      lead.website || "",
      lead.source || "",
      String((lead.llm_cost_usd ?? 0) + (lead.apify_cost_usd ?? 0)),
      lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "",
    ];
    return values.map(escape).join(",");
  });
  return [headers.map(escape).join(","), ...rows].join("\n");
}

// ── Main component ────────────────────────────────────────────────────────

export default function AllLeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCampaignId = searchParams.get("campaign") || "";

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    null
  );
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState(selectedCampaignId);

  // AI filter
  const [aiQuery, setAiQuery] = useState("");
  const [aiFilters, setAiFilters] = useState<LeadFilter[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAIFilter, setShowAIFilter] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pagination
  const [pageSize, setPageSize] = useState<number>(25);
  const [offset, setOffset] = useState(0);

  // Selection
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Sync campaignFilter from URL ────────────────────────────────────────

  useEffect(() => {
    const urlCampaign = searchParams.get("campaign") || "";
    if (urlCampaign !== campaignFilter) {
      setCampaignFilter(urlCampaign);
    }
  }, [searchParams]);

  // ── Fetch campaigns ─────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/lead-finder/campaigns")
      .then((res) => res.json())
      .then((json) => {
        const list = (json.data ?? []).map((c: Record<string, unknown>) => ({
          id: c.id as string,
          name: c.name as string,
          leadFieldDefinitions: (c.leadFieldDefinitions as LeadFieldDefinition[]) || [],
        }));
        setCampaigns(list);
      })
      .catch(() => {});
  }, []);

  // ── Set selected campaign when campaignFilter or campaigns change ───────

  useEffect(() => {
    if (campaignFilter && campaigns.length > 0) {
      const found = campaigns.find((c) => c.id === campaignFilter);
      setSelectedCampaign(found || null);
    } else {
      setSelectedCampaign(null);
    }
  }, [campaignFilter, campaigns]);

  // ── Fetch campaign detail for dynamic fields ────────────────────────────

  useEffect(() => {
    if (!campaignFilter) return;
    fetch(`/api/lead-finder/campaigns/${campaignFilter}`)
      .then((r) => r.json())
      .then((json) => {
        const data = json.data ?? json;
        if (data) {
          setSelectedCampaign({
            id: data.id,
            name: data.name,
            leadFieldDefinitions: data.leadFieldDefinitions || [],
          });
        }
      })
      .catch(() => {});
  }, [campaignFilter]);

  // ── Fetch leads ─────────────────────────────────────────────────────────

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
        sortBy: "created_at",
        sortDir: "desc",
      });
      if (campaignFilter) params.set("campaignId", campaignFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/lead-finder/leads?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setLeads(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch {
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [pageSize, offset, campaignFilter, statusFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // ── Client-side text search ─────────────────────────────────────────────

  const searchFiltered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        l.display_name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.website?.toLowerCase().includes(q)
    );
  }, [leads, search]);

  // ── Apply AI filters on top of text search ──────────────────────────────

  const filteredLeads = useMemo(
    () => applyFilters(searchFiltered, aiFilters),
    [searchFiltered, aiFilters]
  );

  // ── AI filter handler ───────────────────────────────────────────────────

  const handleAIFilter = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/lead-finder/leads/ai-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: aiQuery,
          campaignId: campaignFilter || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Filter generation failed");
      }
      const data = await res.json();
      if (data.filters && data.filters.length > 0) {
        setAiFilters(data.filters);
        toast.success(`Generated ${data.filters.length} filter(s)`);
      } else if (data.data) {
        // API returned filtered leads directly
        setLeads(data.data);
        setTotal(data.data.length);
        setShowAIFilter(false);
        toast.success(`AI found ${data.data.length} matching leads`);
      } else {
        toast.info("No filters could be generated from that query");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate filters"
      );
    } finally {
      setAiLoading(false);
    }
  };

  const removeFilter = (filterId: string) => {
    setAiFilters((prev) => prev.filter((f) => f.id !== filterId));
  };

  const clearAllFilters = () => {
    setAiFilters([]);
    setAiQuery("");
    setShowAIFilter(false);
    fetchLeads();
  };

  // ── Campaign change ─────────────────────────────────────────────────────

  const handleCampaignChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete("campaign");
    } else {
      params.set("campaign", value);
    }
    setCampaignFilter(value);
    setAiFilters([]);
    setAiQuery("");
    setOffset(0);
    router.push(`/dashboard/lead-finder/leads?${params.toString()}`);
  };

  // ── Status update ───────────────────────────────────────────────────────

  const updateLeadStatus = async (id: string, newStatus: string) => {
    try {
      await fetch(`/api/lead-finder/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(`Lead updated to ${newStatus}`);
      fetchLeads();
    } catch {
      toast.error("Failed to update lead status");
    }
  };

  // ── CSV export ──────────────────────────────────────────────────────────

  const handleExportCsv = () => {
    const dynFields = selectedCampaign?.leadFieldDefinitions || [];
    const csv = generateCsv(filteredLeads, dynFields);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${selectedCampaign?.name || "export"}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredLeads.length} leads to CSV`);
  };

  // ── Selection helpers ───────────────────────────────────────────────────

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

  // ── Bulk actions ────────────────────────────────────────────────────────

  const handleBulkImport = async () => {
    const ids = Array.from(selectedLeads);
    if (ids.length === 0) return;
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
    } catch {
      toast.error("Failed to import leads");
    } finally {
      setImporting(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedLeads);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} lead(s)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await Promise.all(
        ids.map((lid) =>
          fetch(`/api/lead-finder/leads/${lid}`, { method: "DELETE" })
        )
      );
      setLeads((prev) => prev.filter((l) => !ids.includes(l.id)));
      setSelectedLeads(new Set());
      toast.success(`${ids.length} lead(s) deleted`);
    } catch {
      toast.error("Failed to delete leads");
    } finally {
      setDeleting(false);
    }
  };

  // ── Pagination helpers ──────────────────────────────────────────────────

  const totalPages = Math.ceil(total / pageSize);
  const currentPage = Math.floor(offset / pageSize) + 1;

  const goToPage = (page: number) => {
    setOffset((page - 1) * pageSize);
    setSelectedLeads(new Set());
  };

  // ── Campaign name map ───────────────────────────────────────────────────

  const campaignNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    campaigns.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [campaigns]);

  // ── Dynamic fields ──────────────────────────────────────────────────────

  const dynFields = selectedCampaign?.leadFieldDefinitions || [];

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-950 dark:text-neutral-50">
            Lead Finder
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {selectedCampaign
              ? `${filteredLeads.length} of ${total} leads in ${selectedCampaign.name}`
              : "All leads across campaigns"}
          </p>
        </div>
        {filteredLeads.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            leftIcon={<DownloadIcon size={14} />}
          >
            Export CSV
          </Button>
        )}
      </div>

      {/* Sub nav */}
      <LeadFinderSubNav />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-xs">
          <Input
            leftIcon={<MagnifyingGlassIcon size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, website..."
          />
        </div>

        {/* Campaign filter */}
        <Select
          value={campaignFilter}
          onChange={(e) => handleCampaignChange(e.target.value)}
          options={campaigns.map((c) => ({ label: c.name, value: c.id }))}
          placeholder="All Campaigns"
        />

        {/* Status filter */}
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setOffset(0);
          }}
          options={STATUS_OPTIONS.map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }))}
          placeholder="All Statuses"
        />

        {/* AI Filter toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAIFilter(!showAIFilter)}
          leftIcon={<SparkleIcon size={14} />}
          className={showAIFilter || aiFilters.length > 0 ? "bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600" : ""}
        >
          AI Filter
        </Button>

        {/* Bulk actions */}
        {selectedLeads.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {selectedLeads.size} selected
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBulkImport}
              disabled={importing}
              leftIcon={importing ? <CircleNotchIcon size={12} className="animate-spin" /> : <ArrowRightIcon size={12} />}
            >
              Import to CRM
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDelete}
              disabled={deleting}
              leftIcon={deleting ? <CircleNotchIcon size={12} className="animate-spin" /> : <TrashIcon size={12} />}
              className="text-red-600 dark:text-red-400 border-red-400/20 hover:bg-red-400/20"
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* AI Filter panel */}
      {showAIFilter && (
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
            Describe the kind of leads you are looking for in natural language:
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAIFilter();
            }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder='e.g., "leads with more than 1000 followers that are business accounts"'
              disabled={aiLoading}
              className="flex-1"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={aiLoading || !aiQuery.trim()}
              leftIcon={aiLoading ? <CircleNotchIcon size={14} className="animate-spin" /> : <SparkleIcon size={14} />}
            >
              Filter
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={clearAllFilters}
            >
              Clear
            </Button>
          </form>
        </div>
      )}

      {/* Active AI filter chips */}
      {aiFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Active filters:
          </span>
          {aiFilters.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium"
            >
              {f.label}
              <button
                onClick={() => removeFilter(f.id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                <XIcon size={10} />
              </button>
            </span>
          ))}
          <button
            onClick={clearAllFilters}
            className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <CircleNotchIcon
            size={32}
            className="animate-spin text-neutral-500 dark:text-neutral-400"
          />
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredLeads.length === 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col items-center justify-center py-16">
          <UsersIcon
            size={40}
            className="mb-4 text-neutral-400 dark:text-neutral-600"
          />
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">
            {aiFilters.length > 0
              ? "No leads match the current filters"
              : selectedCampaign
                ? "No leads found in this campaign"
                : "No leads found"}
          </p>
        </div>
      )}

      {/* Leads table */}
      {!loading && filteredLeads.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedLeads.size === filteredLeads.length &&
                        filteredLeads.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-950"
                    />
                  </th>
                  <th className="p-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider min-w-[180px]">
                    Name
                  </th>
                  {/* Dynamic campaign columns */}
                  {dynFields.map((f) => (
                    <th
                      key={f.id}
                      className="p-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider min-w-[120px]"
                    >
                      {f.label}
                    </th>
                  ))}
                  <th className="p-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Email
                  </th>
                  {!campaignFilter && (
                    <th className="p-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Campaign
                    </th>
                  )}
                  <th className="p-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider min-w-[70px]">
                    Score
                  </th>
                  <th className="p-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider min-w-[80px]">
                    Cost
                  </th>
                  <th className="p-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider min-w-[100px]">
                    Status
                  </th>
                  <th className="p-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="p-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const displayName =
                    lead.display_name || lead.email || lead.website || "Unknown";
                  const totalCost =
                    (lead.llm_cost_usd ?? 0) + (lead.apify_cost_usd ?? 0);

                  return (
                    <tr
                      key={lead.id}
                      className="border-b border-neutral-200 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/dashboard/lead-finder/leads/${lead.id}`
                        )
                      }
                    >
                      <td
                        className="p-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedLeads.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          className="rounded border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-950"
                        />
                      </td>
                      <td className="p-3">
                        <Link
                          href={`/dashboard/lead-finder/leads/${lead.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm text-neutral-950 dark:text-neutral-50 font-medium hover:underline break-words line-clamp-2"
                        >
                          {displayName}
                        </Link>
                      </td>
                      {/* Dynamic field columns */}
                      {dynFields.map((f) => {
                        const val = formatFieldValue(
                          resolveFieldValue(lead, f.id),
                          f.type
                        );
                        if (
                          (f.type === "url" || val.startsWith("http")) &&
                          val !== "\u2014"
                        ) {
                          return (
                            <td
                              key={f.id}
                              className="p-3 text-xs truncate max-w-[180px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <a
                                href={val}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline inline-flex items-center gap-1"
                              >
                                {val
                                  .replace(/^https?:\/\/(www\.)?/, "")
                                  .split("/")[0]}
                                <ArrowSquareOutIcon size={10} />
                              </a>
                            </td>
                          );
                        }
                        return (
                          <td
                            key={f.id}
                            className="p-3 text-sm text-neutral-700 dark:text-neutral-300 truncate max-w-[180px]"
                          >
                            {val}
                          </td>
                        );
                      })}
                      <td className="p-3">
                        {lead.email ? (
                          <span className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                            <EnvelopeIcon size={12} />
                            {lead.email}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400 dark:text-neutral-500">
                            --
                          </span>
                        )}
                      </td>
                      {!campaignFilter && (
                        <td className="p-3">
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            {campaignNameMap[lead.campaign_id] || "Unknown"}
                          </span>
                        </td>
                      )}
                      <td className="p-3">
                        <ScoreBadge score={lead.score} />
                      </td>
                      <td className="p-3 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                        {totalCost > 0 ? `$${totalCost.toFixed(4)}` : "\u2014"}
                      </td>
                      <td
                        className="p-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <StatusDropdown
                          status={lead.status}
                          onSelect={(s) => updateLeadStatus(lead.id, s)}
                        />
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">
                          {lead.source?.replace(/_/g, " ") || "--"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-4">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  Showing {offset + 1}-{Math.min(offset + pageSize, total)} of{" "}
                  {total}
                </span>
                <Select
                  value={String(pageSize)}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setOffset(0);
                  }}
                  options={PAGE_SIZES.map((s) => ({ label: `${s} per page`, value: String(s) }))}
                  className="text-xs py-1"
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 disabled:opacity-30 transition-colors"
                >
                  <CaretLeftIcon size={14} />
                </button>
                {Array.from(
                  { length: Math.min(5, totalPages) },
                  (_, i) => {
                    let page: number;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          page === currentPage
                            ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950"
                            : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  }
                )}
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 disabled:opacity-30 transition-colors"
                >
                  <CaretRightIcon size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Status Dropdown ─────────────────────────────────────────────────────────

function StatusDropdown({
  status,
  onSelect,
}: {
  status: string;
  onSelect: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize cursor-pointer hover:opacity-80 transition-opacity ${
          LEAD_STATUS_STYLES[status] ||
          "text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800"
        }`}
      >
        {status}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg py-1 min-w-[140px]">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              disabled={s === status}
              onClick={() => {
                onSelect(s);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                  LEAD_STATUS_STYLES[s] ||
                  "text-neutral-500 bg-neutral-100 dark:bg-neutral-800"
                }`}
              >
                {s}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
