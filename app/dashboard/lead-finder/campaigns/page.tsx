"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  PlusIcon,
  TrashIcon,
  UsersIcon,
  SparkleIcon,
  TargetIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  CircleNotchIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
} from "@/components/ui";
import { LeadFinderSubNav } from "@/components/lead-finder/SubNav";

// ── Types ──────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  target_niche: string;
  status: string;
  ai_provider: string;
  schedule_frequency: string;
  auto_enrich: boolean;
  created_at: string;
  apify_actors: string[];
  leadCount: number;
  enrichedCount: number;
  avgScore: number;
  totalCost: number;
  avgCostPerLead: number;
}

// ── Status helpers ─────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  draft: "text-[#a0a0a8] bg-[#232329]",
  active: "text-emerald-400 bg-emerald-400/10",
  paused: "text-amber-400 bg-amber-400/10",
  completed: "text-blue-400 bg-blue-400/10",
  archived: "text-red-400 bg-red-400/10",
};

const PROVIDER_STYLES: Record<string, string> = {
  anthropic: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  openai: "text-green-400 bg-green-400/10 border-green-400/20",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}
    >
      {status === "active" && <PlayIcon size={10} />}
      {status === "paused" && <PauseIcon size={10} />}
      {status === "draft" && <ClockIcon size={10} />}
      {status === "completed" && <CheckCircleIcon size={10} />}
      {status}
    </span>
  );
}

// ── Delete confirmation modal ──────────────────────────────────────────────

function DeleteModal({
  campaign,
  onConfirm,
  onCancel,
}: {
  campaign: Campaign;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-[#141417] border border-[#232329] rounded-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-white mb-2">
          Delete Campaign
        </h3>
        <p className="text-[#a0a0a8] text-sm mb-1">
          Are you sure you want to delete{" "}
          <span className="text-white font-medium">{campaign.name}</span>?
        </p>
        <p className="text-[#a0a0a8] text-sm mb-6">
          This will permanently remove the campaign and all {campaign.leadCount}{" "}
          associated leads. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-[#232329] text-[#a0a0a8] text-sm font-medium hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 transition-colors"
          >
            Delete Campaign
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/lead-finder/campaigns");
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      const json = await res.json();
      setCampaigns(json.data ?? []);
    } catch (err) {
      toast.error("Failed to load campaigns");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleDelete = async (campaign: Campaign) => {
    setDeleting(campaign.id);
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/lead-finder/campaigns/${campaign.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete campaign");
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
      toast.success(`Campaign "${campaign.name}" deleted`);
    } catch {
      toast.error("Failed to delete campaign");
    } finally {
      setDeleting(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0c] p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Finder</h1>
          <p className="text-sm text-[#a0a0a8] mt-1">
            AI-powered lead discovery and enrichment campaigns
          </p>
        </div>
        <Link
          href="/dashboard/lead-finder/campaigns/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
        >
          <PlusIcon size={16} weight="bold" />
          New Campaign
        </Link>
      </div>

      {/* Sub nav */}
      <LeadFinderSubNav />

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <CircleNotchIcon
            size={32}
            className="animate-spin text-[#a0a0a8]"
          />
        </div>
      )}

      {/* Empty state */}
      {!loading && campaigns.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#141417] border border-[#232329] flex items-center justify-center mb-4">
            <TargetIcon size={28} className="text-[#a0a0a8]" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">
            No campaigns yet
          </h2>
          <p className="text-sm text-[#a0a0a8] max-w-md mb-6">
            Create your first lead finder campaign to start discovering and
            enriching leads with AI.
          </p>
          <Link
            href="/dashboard/lead-finder/campaigns/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
          >
            <PlusIcon size={16} weight="bold" />
            Create Campaign
          </Link>
        </div>
      )}

      {/* Campaign grid */}
      {!loading && campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="group relative bg-[#141417] border border-[#232329] rounded-xl p-5 hover:border-[#333339] transition-colors cursor-pointer"
              onClick={() =>
                router.push(`/dashboard/lead-finder/campaigns/${campaign.id}`)
              }
            >
              {/* Header row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-3">
                  <h3 className="text-white font-semibold text-sm truncate">
                    {campaign.name}
                  </h3>
                  <p className="text-xs text-[#a0a0a8] mt-0.5 truncate">
                    {campaign.target_niche}
                  </p>
                </div>
                <StatusBadge status={campaign.status} />
              </div>

              {/* Description */}
              {campaign.description && (
                <p className="text-xs text-[#a0a0a8] mb-4 line-clamp-2">
                  {campaign.description}
                </p>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-[#a0a0a8] mb-1">
                    <UsersIcon size={12} />
                    <span className="text-[10px] uppercase tracking-wider">
                      Leads
                    </span>
                  </div>
                  <p className="text-white text-lg font-semibold">
                    {campaign.leadCount}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-[#a0a0a8] mb-1">
                    <SparkleIcon size={12} />
                    <span className="text-[10px] uppercase tracking-wider">
                      Enriched
                    </span>
                  </div>
                  <p className="text-white text-lg font-semibold">
                    {campaign.enrichedCount}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-[#a0a0a8] mb-1">
                    <ChartBarIcon size={12} />
                    <span className="text-[10px] uppercase tracking-wider">
                      Avg Score
                    </span>
                  </div>
                  <p
                    className={`text-lg font-semibold ${
                      campaign.avgScore >= 70
                        ? "text-emerald-400"
                        : campaign.avgScore >= 40
                          ? "text-amber-400"
                          : "text-white"
                    }`}
                  >
                    {campaign.avgScore}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[#232329]">
                <div className="flex items-center gap-2">
                  {/* Cost */}
                  <span className="inline-flex items-center gap-1 text-xs text-[#a0a0a8]">
                    <CurrencyDollarIcon size={12} />$
                    {campaign.totalCost.toFixed(4)}
                  </span>
                  {/* AI provider badge */}
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                      PROVIDER_STYLES[campaign.ai_provider] ||
                      PROVIDER_STYLES.anthropic
                    }`}
                  >
                    {campaign.ai_provider === "anthropic"
                      ? "Claude"
                      : "GPT"}
                  </span>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(campaign);
                  }}
                  disabled={deleting === campaign.id}
                  className="p-1.5 rounded-lg text-[#a0a0a8] hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  {deleting === campaign.id ? (
                    <CircleNotchIcon size={14} className="animate-spin" />
                  ) : (
                    <TrashIcon size={14} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteModal
          campaign={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
