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
import { PageHeader } from "@/components/dashboard";
import { Button, Badge } from "@/components/ui";
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

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  draft:     { color: "neutral", icon: <ClockIcon size={10} /> },
  active:    { color: "green",   icon: <PlayIcon size={10} /> },
  paused:    { color: "amber",   icon: <PauseIcon size={10} /> },
  completed: { color: "blue",    icon: <CheckCircleIcon size={10} /> },
  archived:  { color: "red",     icon: null },
};

// ── Delete confirmation modal ──────────────────────────────────────────────

function DeleteModal({ campaign, onConfirm, onCancel }: { campaign: Campaign; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-base font-semibold text-neutral-950 dark:text-neutral-50 mb-2">Delete Campaign</h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
          Are you sure you want to delete <span className="text-neutral-950 dark:text-neutral-50 font-medium">{campaign.name}</span>?
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
          This will permanently remove the campaign and all {campaign.leadCount} associated leads. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white border-0 dark:bg-red-600 dark:hover:bg-red-700 dark:text-white" onClick={onConfirm}>Delete Campaign</Button>
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
      if (!res.ok) throw new Error();
      const json = await res.json();
      setCampaigns(json.data ?? []);
    } catch { toast.error("Failed to load campaigns"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const handleDelete = async (campaign: Campaign) => {
    setDeleting(campaign.id);
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/lead-finder/campaigns/${campaign.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
      toast.success(`"${campaign.name}" deleted`);
    } catch { toast.error("Failed to delete campaign"); }
    finally { setDeleting(null); }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader title="Lead Finder">
        <Link href="/dashboard/lead-finder/campaigns/new">
          <Button leftIcon={<PlusIcon size={15} />}>New Campaign</Button>
        </Link>
      </PageHeader>

      <LeadFinderSubNav />

      {loading && (
        <div className="flex items-center justify-center py-24">
          <CircleNotchIcon size={28} className="animate-spin text-neutral-400" />
        </div>
      )}

      {!loading && campaigns.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center mb-4">
            <TargetIcon size={28} className="text-neutral-400" />
          </div>
          <h2 className="text-base font-semibold text-neutral-950 dark:text-neutral-50 mb-2">No campaigns yet</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mb-6">
            Create your first lead finder campaign to start discovering and enriching leads with AI.
          </p>
          <Link href="/dashboard/lead-finder/campaigns/new">
            <Button leftIcon={<PlusIcon size={15} />}>Create Campaign</Button>
          </Link>
        </div>
      )}

      {!loading && campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => {
            const statusCfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft;
            return (
              <div
                key={campaign.id}
                className="group relative rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/lead-finder/campaigns/${campaign.id}`)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-3">
                    <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 truncate">{campaign.name}</h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{campaign.target_niche}</p>
                  </div>
                  <Badge variant={statusCfg.color as "neutral" | "green" | "amber" | "blue" | "red"}>
                    <span className="flex items-center gap-1">
                      {statusCfg.icon}
                      <span className="capitalize">{campaign.status}</span>
                    </span>
                  </Badge>
                </div>

                {campaign.description && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 line-clamp-2">{campaign.description}</p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { icon: <UsersIcon size={12} />, label: "Leads", value: campaign.leadCount, color: "" },
                    { icon: <SparkleIcon size={12} />, label: "Enriched", value: campaign.enrichedCount, color: "" },
                    {
                      icon: <ChartBarIcon size={12} />, label: "Avg Score", value: campaign.avgScore,
                      color: campaign.avgScore >= 70 ? "text-green-600 dark:text-green-400" : campaign.avgScore >= 40 ? "text-amber-600 dark:text-amber-400" : ""
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center">
                      <div className="flex items-center justify-center gap-1 text-neutral-400 dark:text-neutral-500 mb-1">
                        {stat.icon}
                        <span className="text-[10px] uppercase tracking-wider">{stat.label}</span>
                      </div>
                      <p className={`text-lg font-serif font-semibold ${stat.color || "text-neutral-950 dark:text-neutral-50"}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                      <CurrencyDollarIcon size={12} />${campaign.totalCost.toFixed(4)}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${campaign.ai_provider === "anthropic" ? "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400" : "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"}`}>
                      {campaign.ai_provider === "anthropic" ? "Claude" : "GPT"}
                    </span>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(campaign); }}
                    disabled={deleting === campaign.id}
                    className="p-1.5 rounded text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    {deleting === campaign.id ? <CircleNotchIcon size={14} className="animate-spin" /> : <TrashIcon size={14} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
