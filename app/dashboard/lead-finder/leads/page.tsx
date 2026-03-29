"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MagnifyingGlassIcon,
  TrashIcon,
  ArrowRightIcon,
  CircleNotchIcon,
  SparkleIcon,
  EnvelopeIcon,
} from "@/components/ui";
import { LeadFinderSubNav } from "@/components/lead-finder/SubNav";
import { ScoreBadge } from "@/components/lead-finder/ScoreBadge";

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
}

interface Campaign {
  id: string;
  name: string;
}

// ── Status styles ──────────────────────────────────────────────────────────

const LEAD_STATUS_STYLES: Record<string, string> = {
  new: "text-blue-400 bg-blue-400/10",
  enriching: "text-amber-400 bg-amber-400/10",
  enriched: "text-green-400 bg-green-400/10",
  qualified: "text-emerald-400 bg-emerald-400/10",
  disqualified: "text-red-400 bg-red-400/10",
  converted: "text-purple-400 bg-purple-400/10",
  error: "text-red-400 bg-red-400/10",
};

// ── Page sizes ─────────────────────────────────────────────────────────────

const PAGE_SIZES = [25, 50, 100] as const;

// ── Main component ─────────────────────────────────────────────────────────

export default function AllLeadsPage() {
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");

  // Pagination
  const [pageSize, setPageSize] = useState<number>(25);
  const [offset, setOffset] = useState(0);

  // Selection
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // AI filter
  const [showAIFilter, setShowAIFilter] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiFiltering, setAiFiltering] = useState(false);

  // ── Fetch campaigns ────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/lead-finder/campaigns")
      .then((res) => res.json())
      .then((json) =>
        setCampaigns(
          (json.data ?? []).map((c: Record<string, unknown>) => ({
            id: c.id as string,
            name: c.name as string,
          }))
        )
      )
      .catch(() => {});
  }, []);

  // ── Fetch leads ────────────────────────────────────────────────────────

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

  // ── Client-side search filter ──────────────────────────────────────────

  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        l.display_name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.website?.toLowerCase().includes(q)
    );
  }, [leads, search]);

  // ── AI filter ──────────────────────────────────────────────────────────

  const handleAIFilter = async () => {
    if (!aiQuery.trim()) return;
    setAiFiltering(true);
    try {
      const res = await fetch("/api/lead-finder/leads/ai-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: aiQuery, campaignId: campaignFilter || undefined }),
      });
      if (!res.ok) throw new Error("AI filter failed");
      const json = await res.json();
      setLeads(json.data ?? []);
      setTotal(json.data?.length ?? 0);
      setShowAIFilter(false);
      toast.success(`AI found ${json.data?.length ?? 0} matching leads`);
    } catch {
      toast.error("AI filter failed");
    } finally {
      setAiFiltering(false);
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

  // ── Bulk actions ───────────────────────────────────────────────────────

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

  // ── Pagination helpers ─────────────────────────────────────────────────

  const totalPages = Math.ceil(total / pageSize);
  const currentPage = Math.floor(offset / pageSize) + 1;

  const goToPage = (page: number) => {
    setOffset((page - 1) * pageSize);
    setSelectedLeads(new Set());
  };

  // ── Campaign name map ──────────────────────────────────────────────────

  const campaignNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    campaigns.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [campaigns]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0c] p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Finder</h1>
          <p className="text-sm text-[#a0a0a8] mt-1">
            All leads across campaigns
          </p>
        </div>
      </div>

      {/* Sub nav */}
      <LeadFinderSubNav />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <MagnifyingGlassIcon
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a0a8]"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="w-full pl-8 pr-3 py-2 bg-[#141417] border border-[#232329] rounded-lg text-white text-sm placeholder:text-[#555] focus:outline-none focus:border-[#444]"
          />
        </div>

        {/* Campaign filter */}
        <select
          value={campaignFilter}
          onChange={(e) => {
            setCampaignFilter(e.target.value);
            setOffset(0);
          }}
          className="px-3 py-2 bg-[#141417] border border-[#232329] rounded-lg text-white text-sm focus:outline-none focus:border-[#444]"
        >
          <option value="">All Campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setOffset(0);
          }}
          className="px-3 py-2 bg-[#141417] border border-[#232329] rounded-lg text-white text-sm focus:outline-none focus:border-[#444]"
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="enriching">Enriching</option>
          <option value="enriched">Enriched</option>
          <option value="qualified">Qualified</option>
          <option value="disqualified">Disqualified</option>
          <option value="converted">Converted</option>
        </select>

        {/* AI Filter button */}
        <button
          onClick={() => setShowAIFilter(!showAIFilter)}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            showAIFilter
              ? "bg-white/5 text-white border-white/20"
              : "bg-[#141417] text-[#a0a0a8] border-[#232329] hover:text-white"
          }`}
        >
          <SparkleIcon size={14} />
          AI Filter
        </button>

        {/* Bulk actions */}
        {selectedLeads.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-[#a0a0a8]">
              {selectedLeads.size} selected
            </span>
            <button
              onClick={handleBulkImport}
              disabled={importing}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 text-xs font-medium hover:bg-emerald-400/20 transition-colors"
            >
              {importing ? (
                <CircleNotchIcon size={12} className="animate-spin" />
              ) : (
                <ArrowRightIcon size={12} />
              )}
              Import to CRM
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-red-400/10 text-red-400 border border-red-400/20 text-xs font-medium hover:bg-red-400/20 transition-colors"
            >
              {deleting ? (
                <CircleNotchIcon size={12} className="animate-spin" />
              ) : (
                <TrashIcon size={12} />
              )}
              Delete
            </button>
          </div>
        )}
      </div>

      {/* AI Filter panel */}
      {showAIFilter && (
        <div className="mb-4 p-4 bg-[#141417] border border-[#232329] rounded-xl">
          <p className="text-xs text-[#a0a0a8] mb-2">
            Describe the kind of leads you are looking for in natural language:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAIFilter()}
              placeholder='e.g., "SaaS companies with more than 20 employees that use React"'
              className="flex-1 px-3 py-2 bg-[#0a0a0c] border border-[#232329] rounded-lg text-white text-sm placeholder:text-[#555] focus:outline-none focus:border-[#444]"
            />
            <button
              onClick={handleAIFilter}
              disabled={aiFiltering || !aiQuery.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-50 transition-colors"
            >
              {aiFiltering ? (
                <CircleNotchIcon size={14} className="animate-spin" />
              ) : (
                <SparkleIcon size={14} />
              )}
              Filter
            </button>
            <button
              onClick={() => {
                setShowAIFilter(false);
                setAiQuery("");
                fetchLeads();
              }}
              className="px-3 py-2 rounded-lg bg-[#232329] text-[#a0a0a8] text-sm hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <CircleNotchIcon size={32} className="animate-spin text-[#a0a0a8]" />
        </div>
      )}

      {/* Leads table */}
      {!loading && (
        <div className="bg-[#141417] border border-[#232329] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#232329]">
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedLeads.size === filteredLeads.length &&
                        filteredLeads.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-[#444] bg-[#0a0a0c]"
                    />
                  </th>
                  <th className="p-3 text-xs font-medium text-[#a0a0a8] uppercase tracking-wider">
                    Name
                  </th>
                  <th className="p-3 text-xs font-medium text-[#a0a0a8] uppercase tracking-wider">
                    Email
                  </th>
                  <th className="p-3 text-xs font-medium text-[#a0a0a8] uppercase tracking-wider">
                    Campaign
                  </th>
                  <th className="p-3 text-xs font-medium text-[#a0a0a8] uppercase tracking-wider">
                    Score
                  </th>
                  <th className="p-3 text-xs font-medium text-[#a0a0a8] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="p-3 text-xs font-medium text-[#a0a0a8] uppercase tracking-wider">
                    Source
                  </th>
                  <th className="p-3 text-xs font-medium text-[#a0a0a8] uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-sm text-[#a0a0a8]">
                      No leads found.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-[#232329]/50 hover:bg-[#1a1a1f] transition-colors cursor-pointer"
                      onClick={() =>
                        router.push(`/dashboard/lead-finder/leads/${lead.id}`)
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
                          className="rounded border-[#444] bg-[#0a0a0c]"
                        />
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-white font-medium">
                          {lead.display_name || "Unknown"}
                        </span>
                      </td>
                      <td className="p-3">
                        {lead.email ? (
                          <span className="text-sm text-[#a0a0a8] flex items-center gap-1">
                            <EnvelopeIcon size={12} />
                            {lead.email}
                          </span>
                        ) : (
                          <span className="text-xs text-[#555]">--</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-[#a0a0a8]">
                          {campaignNameMap[lead.campaign_id] || "Unknown"}
                        </span>
                      </td>
                      <td className="p-3">
                        <ScoreBadge score={lead.score} />
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            LEAD_STATUS_STYLES[lead.status] || "text-[#a0a0a8] bg-[#232329]"
                          }`}
                        >
                          {lead.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-[#a0a0a8] capitalize">
                          {lead.source?.replace(/_/g, " ") || "--"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-[#a0a0a8]">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#232329]">
              <div className="flex items-center gap-4">
                <span className="text-xs text-[#a0a0a8]">
                  Showing {offset + 1}-{Math.min(offset + pageSize, total)} of{" "}
                  {total}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setOffset(0);
                  }}
                  className="px-2 py-1 bg-[#0a0a0c] border border-[#232329] rounded text-white text-xs focus:outline-none"
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s} per page
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="px-2 py-1 rounded text-xs text-[#a0a0a8] hover:text-white disabled:opacity-30 transition-colors"
                >
                  Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
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
                          ? "bg-white text-black"
                          : "text-[#a0a0a8] hover:text-white"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="px-2 py-1 rounded text-xs text-[#a0a0a8] hover:text-white disabled:opacity-30 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
