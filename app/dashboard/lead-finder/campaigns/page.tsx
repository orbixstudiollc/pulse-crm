"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  PlusIcon,
  TrashIcon,
  TargetIcon,
  MagnifyingGlassIcon,
  CircleNotchIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
} from "@/components/ui";
import { Page, PageHeader, TableSection, EmptyState } from "@/components/dashboard";
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

// ── Relative date ─────────────────────────────────────────────────────────

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Status helpers ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  draft:     { color: "neutral", icon: <ClockIcon size={10} /> },
  active:    { color: "success", icon: <PlayIcon size={10} /> },
  paused:    { color: "warning", icon: <PauseIcon size={10} /> },
  completed: { color: "info",    icon: <CheckCircleIcon size={10} /> },
  archived:  { color: "error",   icon: null },
};

// ── Delete confirmation modal ──────────────────────────────────────────────

function DeleteModal({ campaign, onConfirm, onCancel }: { campaign: Campaign; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div data-clay-box className="relative bg-surface border border-line rounded-lg shadow-modal p-4 max-w-md w-full mx-4">
        <h3 className="text-base font-semibold text-fg mb-2">Delete Campaign</h3>
        <p className="text-sm text-fg-secondary mb-1">
          Are you sure you want to delete <span className="text-fg font-medium">{campaign.name}</span>?
        </p>
        <p className="text-sm text-fg-secondary mb-6">
          This will permanently remove the campaign and all {campaign.leadCount} associated leads. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" className="bg-danger text-on-inverse hover:opacity-90 border-0" onClick={onConfirm}>Delete Campaign</Button>
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
    <Page>
      <PageHeader title="Lead Finder" icon={<MagnifyingGlassIcon size={18} />}>
        <Link href="/dashboard/lead-finder/campaigns/new">
          <Button leftIcon={<PlusIcon size={15} />}>New Campaign</Button>
        </Link>
      </PageHeader>

      <div className="px-8 max-sm:px-4">
        <LeadFinderSubNav />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <CircleNotchIcon size={28} className="animate-spin text-fg-muted" />
        </div>
      )}

      {!loading && campaigns.length === 0 && (
        <EmptyState
          icon={<TargetIcon />}
          title="No campaigns yet"
          description="Create your first lead finder campaign to start discovering and enriching leads with AI."
          actions={[
            {
              label: "Create Campaign",
              href: "/dashboard/lead-finder/campaigns/new",
              variant: "primary",
              icon: <PlusIcon size={15} />,
            },
          ]}
        />
      )}

      {!loading && campaigns.length > 0 && (
        <TableSection title="Campaigns">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left">Campaign</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Leads</th>
                  <th className="text-left">Enriched</th>
                  <th className="text-left">Score</th>
                  <th className="text-left">Cost</th>
                  <th className="text-left">Provider</th>
                  <th className="text-left">Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const statusCfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft;
                  return (
                    <tr
                      key={campaign.id}
                      className="group cursor-pointer transition-colors"
                      onClick={() => router.push(`/dashboard/lead-finder/campaigns/${campaign.id}`)}
                    >
                      <td className="py-2 text-[14px] text-fg">
                        <div className="flex min-w-0 items-center gap-2">
                          <TargetIcon size={16} className="shrink-0 text-fg-muted" />
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-medium text-fg">{campaign.name}</p>
                            <p className="truncate text-xs text-fg-secondary">{campaign.target_niche}</p>
                            {campaign.description && (
                              <p className="max-w-[320px] truncate text-xs text-fg-muted">{campaign.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 text-[14px] text-fg">
                        <Badge variant={statusCfg.color as "neutral" | "success" | "warning" | "info" | "error"}>
                          <span className="flex items-center gap-1">
                            {statusCfg.icon}
                            <span className="capitalize">{campaign.status}</span>
                          </span>
                        </Badge>
                      </td>
                      <td className="py-2 text-[14px] font-medium text-fg">{campaign.leadCount}</td>
                      <td className="py-2 text-[14px] font-medium text-fg">
                        {campaign.enrichedCount}
                        {campaign.leadCount > 0 && (
                          <span className="text-xs font-sans font-normal text-fg-muted">
                            /{campaign.leadCount}
                          </span>
                        )}
                      </td>
                      <td className={`py-2 text-[14px] font-medium ${campaign.avgScore >= 70 ? "text-success" : campaign.avgScore >= 40 ? "text-warning" : "text-fg"}`}>
                        {campaign.avgScore}
                      </td>
                      <td className="whitespace-nowrap py-2 text-xs text-fg-secondary">
                        ${campaign.totalCost.toFixed(4)}
                        {campaign.avgCostPerLead > 0 && (
                          <span className="text-fg-muted">
                            {" "}· ${campaign.avgCostPerLead.toFixed(4)}/lead
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                          campaign.ai_provider === "anthropic"
                            ? "bg-warning-surface text-warning"
                            : campaign.ai_provider === "openrouter"
                              ? "bg-accent-surface text-accent-on-surface"
                              : "bg-success-surface text-success"
                        }`}>
                          {campaign.ai_provider === "anthropic" ? "Claude" : campaign.ai_provider === "openrouter" ? "OpenRouter" : "GPT"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-2 text-xs text-fg-muted">
                        {relativeDate(campaign.created_at)}
                      </td>
                      <td className="py-2">
                        <div className="flex justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(campaign); }}
                            disabled={deleting === campaign.id}
                            className="p-1.5 rounded text-fg-muted hover:text-danger hover:bg-danger-surface transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            {deleting === campaign.id ? <CircleNotchIcon size={14} className="animate-spin" /> : <TrashIcon size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TableSection>
      )}

      {deleteTarget && (
        <DeleteModal
          campaign={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </Page>
  );
}
