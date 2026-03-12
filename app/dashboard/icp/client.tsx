"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Button,
  Badge,
  Modal,
  Input,
  Textarea,
  TagInput,
  Checkbox,
  DeleteConfirmModal,
  PlusIcon,
  PencilSimpleIcon,
  TrashIcon,
  CrosshairIcon,
  CircleNotchIcon,
  EyeIcon,
} from "@/components/ui";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard";
import {
  createICPProfile,
  updateICPProfile,
  deleteICPProfile,
  recalculateICPMatches,
  type ICPCriteria,
  type ICPWeights,
} from "@/lib/actions/icp";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ICPProfile {
  id: string;
  name: string;
  description: string | null;
  criteria: unknown;
  weights: unknown;
  buyer_personas: unknown;
  color: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

interface ICPInsightsData {
  totalLeads: number;
  matchedLeads: number;
  unmatchedLeads: number;
  distribution: Array<{
    count: number;
    name: string;
    color: string;
    avgScore: number;
  }>;
  avgMatchScore: number;
}

interface ICPClientProps {
  profiles: ICPProfile[];
  insights: ICPInsightsData | null;
}

// ── Default values ────────────────────────────────────────────────────────────

const defaultCriteria: ICPCriteria = {
  firmographic: {
    industries: [],
    company_sizes: [],
    employee_range: { min: null, max: null },
    geography: [],
  },
  technographic: {
    tech_stack: [],
    tech_sophistication_min: 0,
  },
  behavioral: {
    buying_patterns: [],
    trigger_events: [],
  },
  pain_points: [],
  budget: {
    revenue_range: { min: null, max: null },
    deal_size_sweet_spot: null,
    funding_stages: [],
  },
  channel: {
    preferred_contact_methods: [],
    content_preferences: [],
  },
};

const defaultWeights: ICPWeights = {
  industry: 25,
  size: 20,
  revenue: 15,
  title: 15,
  geography: 15,
  tech: 10,
};

const companySizeOptions = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5000+",
];

const colorOptions = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#64748b",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCriteria(raw: unknown): ICPCriteria {
  if (!raw || typeof raw !== "object") return defaultCriteria;
  const c = raw as Record<string, unknown>;
  return {
    firmographic: {
      industries: (c.firmographic as Record<string, unknown>)?.industries as string[] ?? [],
      company_sizes: (c.firmographic as Record<string, unknown>)?.company_sizes as string[] ?? [],
      employee_range: (c.firmographic as Record<string, unknown>)?.employee_range as { min: number | null; max: number | null } ?? { min: null, max: null },
      geography: (c.firmographic as Record<string, unknown>)?.geography as string[] ?? [],
    },
    technographic: {
      tech_stack: (c.technographic as Record<string, unknown>)?.tech_stack as string[] ?? [],
      tech_sophistication_min: (c.technographic as Record<string, unknown>)?.tech_sophistication_min as number ?? 0,
    },
    behavioral: {
      buying_patterns: (c.behavioral as Record<string, unknown>)?.buying_patterns as string[] ?? [],
      trigger_events: (c.behavioral as Record<string, unknown>)?.trigger_events as string[] ?? [],
    },
    pain_points: (c.pain_points as Array<{ name: string; severity: number }>) ?? [],
    budget: {
      revenue_range: (c.budget as Record<string, unknown>)?.revenue_range as { min: number | null; max: number | null } ?? { min: null, max: null },
      deal_size_sweet_spot: (c.budget as Record<string, unknown>)?.deal_size_sweet_spot as number | null ?? null,
      funding_stages: (c.budget as Record<string, unknown>)?.funding_stages as string[] ?? [],
    },
    channel: {
      preferred_contact_methods: (c.channel as Record<string, unknown>)?.preferred_contact_methods as string[] ?? [],
      content_preferences: (c.channel as Record<string, unknown>)?.content_preferences as string[] ?? [],
    },
  };
}

function parseWeights(raw: unknown): ICPWeights {
  if (!raw || typeof raw !== "object") return defaultWeights;
  const w = raw as Record<string, unknown>;
  return {
    industry: (w.industry as number) ?? 25,
    size: (w.size as number) ?? 20,
    revenue: (w.revenue as number) ?? 15,
    title: (w.title as number) ?? 15,
    geography: (w.geography as number) ?? 15,
    tech: (w.tech as number) ?? 10,
  };
}

function getDistributionForProfile(
  insights: ICPInsightsData | null,
  profileName: string,
) {
  if (!insights) return { count: 0, avgScore: 0 };
  const dist = insights.distribution.find((d) => d.name === profileName);
  return dist ? { count: dist.count, avgScore: dist.avgScore } : { count: 0, avgScore: 0 };
}

// ── ICPProfileModal ───────────────────────────────────────────────────────────

function ICPProfileModal({
  open,
  onClose,
  editProfile,
}: {
  open: boolean;
  onClose: () => void;
  editProfile?: ICPProfile | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const editCriteria = editProfile ? parseCriteria(editProfile.criteria) : defaultCriteria;
  const editWeights = editProfile ? parseWeights(editProfile.weights) : defaultWeights;

  const [name, setName] = useState(editProfile?.name ?? "");
  const [description, setDescription] = useState(editProfile?.description ?? "");
  const [color, setColor] = useState(editProfile?.color ?? "#6366f1");
  const [isPrimary, setIsPrimary] = useState(editProfile?.is_primary ?? false);

  // Firmographic
  const [industries, setIndustries] = useState<string[]>(editCriteria.firmographic.industries);
  const [companySizes, setCompanySizes] = useState<string[]>(editCriteria.firmographic.company_sizes);
  const [geography, setGeography] = useState<string[]>(editCriteria.firmographic.geography);

  // Budget
  const [revenueMin, setRevenueMin] = useState<string>(
    editCriteria.budget.revenue_range.min?.toString() ?? "",
  );
  const [revenueMax, setRevenueMax] = useState<string>(
    editCriteria.budget.revenue_range.max?.toString() ?? "",
  );
  const [dealSizeSweetSpot, setDealSizeSweetSpot] = useState<string>(
    editCriteria.budget.deal_size_sweet_spot?.toString() ?? "",
  );

  // Weights
  const [weights, setWeights] = useState<ICPWeights>(editWeights);

  const weightsTotal = Object.values(weights).reduce((s, v) => s + v, 0);

  const updateWeight = (key: keyof ICPWeights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Profile name is required");
      return;
    }

    const criteria: ICPCriteria = {
      firmographic: {
        industries,
        company_sizes: companySizes,
        employee_range: { min: null, max: null },
        geography,
      },
      technographic: {
        tech_stack: [],
        tech_sophistication_min: 0,
      },
      behavioral: {
        buying_patterns: [],
        trigger_events: [],
      },
      pain_points: [],
      budget: {
        revenue_range: {
          min: revenueMin ? Number(revenueMin) : null,
          max: revenueMax ? Number(revenueMax) : null,
        },
        deal_size_sweet_spot: dealSizeSweetSpot ? Number(dealSizeSweetSpot) : null,
        funding_stages: [],
      },
      channel: {
        preferred_contact_methods: [],
        content_preferences: [],
      },
    };

    startTransition(async () => {
      if (editProfile) {
        const res = await updateICPProfile(editProfile.id, {
          name: name.trim(),
          description: description.trim() || null,
          color,
          is_primary: isPrimary,
          criteria,
          weights,
        });
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("ICP profile updated");
          router.refresh();
          onClose();
        }
      } else {
        const res = await createICPProfile({
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          is_primary: isPrimary,
          criteria,
          weights,
        });
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("ICP profile created");
          router.refresh();
          onClose();
        }
      }
    });
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-2xl">
      <div className="p-6">
        {/* Header */}
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50 mb-6">
          {editProfile ? "Edit ICP Profile" : "Create ICP Profile"}
        </h2>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
          {/* Basic Info */}
          <div className="space-y-4">
            <Input
              label="Profile Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Enterprise SaaS"
            />
            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this ideal customer profile..."
            />

            {/* Color Picker */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50">
                Color
              </label>
              <div className="flex items-center gap-2">
                {colorOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-all",
                      color === c
                        ? "border-neutral-950 dark:border-neutral-50 scale-110"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <Checkbox
              label="Set as primary ICP profile"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
            />
          </div>

          {/* Firmographic Criteria */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 uppercase tracking-wide">
              Firmographic Criteria
            </h3>
            <TagInput
              label="Industries"
              tags={industries}
              onChange={setIndustries}
              placeholder="e.g. SaaS, FinTech..."
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50">
                Company Sizes
              </label>
              <div className="flex flex-wrap gap-3">
                {companySizeOptions.map((size) => (
                  <Checkbox
                    key={size}
                    label={size}
                    checked={companySizes.includes(size)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCompanySizes((prev) => [...prev, size]);
                      } else {
                        setCompanySizes((prev) => prev.filter((s) => s !== size));
                      }
                    }}
                  />
                ))}
              </div>
            </div>
            <TagInput
              label="Geography"
              tags={geography}
              onChange={setGeography}
              placeholder="e.g. United States, Europe..."
            />
          </div>

          {/* Budget Criteria */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 uppercase tracking-wide">
              Budget Criteria
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Revenue Min ($)"
                type="number"
                value={revenueMin}
                onChange={(e) => setRevenueMin(e.target.value)}
                placeholder="0"
              />
              <Input
                label="Revenue Max ($)"
                type="number"
                value={revenueMax}
                onChange={(e) => setRevenueMax(e.target.value)}
                placeholder="1000000"
              />
            </div>
            <Input
              label="Deal Size Sweet Spot ($)"
              type="number"
              value={dealSizeSweetSpot}
              onChange={(e) => setDealSizeSweetSpot(e.target.value)}
              placeholder="50000"
            />
          </div>

          {/* Weights */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 uppercase tracking-wide">
                Weights
              </h3>
              <span
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  weightsTotal === 100
                    ? "bg-green-100 dark:bg-green-400/15 text-green-600 dark:text-green-400"
                    : "bg-amber-100 dark:bg-amber-400/15 text-amber-600 dark:text-amber-400",
                )}
              >
                Total: {weightsTotal}%
              </span>
            </div>
            {(
              [
                { key: "industry" as const, label: "Industry" },
                { key: "size" as const, label: "Company Size" },
                { key: "revenue" as const, label: "Revenue" },
                { key: "title" as const, label: "Title / Role" },
                { key: "geography" as const, label: "Geography" },
                { key: "tech" as const, label: "Technology" },
              ] as const
            ).map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-neutral-600 dark:text-neutral-400">
                    {label}
                  </label>
                  <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                    {weights[key]}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={weights[key]}
                  onChange={(e) => updateWeight(key, Number(e.target.value))}
                  className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full appearance-none cursor-pointer accent-neutral-950 dark:accent-neutral-50"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={isPending}
            leftIcon={
              isPending ? <CircleNotchIcon size={18} className="animate-spin" /> : undefined
            }
          >
            {isPending ? "Saving..." : editProfile ? "Update Profile" : "Create Profile"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── ICPProfileCard ────────────────────────────────────────────────────────────

function ICPProfileCard({
  profile,
  insights,
  onEdit,
  onDelete,
}: {
  profile: ICPProfile;
  insights: ICPInsightsData | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const criteria = parseCriteria(profile.criteria);
  const { count, avgScore } = getDistributionForProfile(insights, profile.name);

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: profile.color ?? "#6366f1" }}
            />
            <h3 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
              {profile.name}
            </h3>
            {profile.is_primary && (
              <Badge variant="violet" dot>
                Primary
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Link href={`/dashboard/icp/${profile.id}`}>
              <button className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                <EyeIcon size={16} />
              </button>
            </Link>
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <PencilSimpleIcon size={16} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <TrashIcon size={16} />
            </button>
          </div>
        </div>

        {profile.description && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 line-clamp-2">
            {profile.description}
          </p>
        )}

        {/* Criteria Summary */}
        <div className="space-y-2">
          {criteria.firmographic.industries.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 mr-1">
                Industries:
              </span>
              {criteria.firmographic.industries.slice(0, 3).map((ind) => (
                <Badge key={ind} variant="blue">
                  {ind}
                </Badge>
              ))}
              {criteria.firmographic.industries.length > 3 && (
                <Badge variant="neutral">
                  +{criteria.firmographic.industries.length - 3}
                </Badge>
              )}
            </div>
          )}
          {criteria.firmographic.company_sizes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 mr-1">
                Size:
              </span>
              {criteria.firmographic.company_sizes.map((s) => (
                <Badge key={s} variant="emerald">
                  {s}
                </Badge>
              ))}
            </div>
          )}
          {criteria.firmographic.geography.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 mr-1">
                Geo:
              </span>
              {criteria.firmographic.geography.slice(0, 3).map((g) => (
                <Badge key={g} variant="amber">
                  {g}
                </Badge>
              ))}
              {criteria.firmographic.geography.length > 3 && (
                <Badge variant="neutral">
                  +{criteria.firmographic.geography.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer stats */}
      <div className="border-t border-neutral-200 dark:border-neutral-800 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Matched Leads</p>
            <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">{count}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Avg Score</p>
            <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
              {avgScore > 0 ? `${avgScore}%` : "--"}
            </p>
          </div>
        </div>
        <Link href={`/dashboard/icp/${profile.id}`}>
          <Button variant="ghost" size="sm">
            View Details
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ICPClient({ profiles, insights }: ICPClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [editProfile, setEditProfile] = useState<ICPProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ICPProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreate = () => {
    setEditProfile(null);
    setShowModal(true);
  };

  const handleEdit = (profile: ICPProfile) => {
    setEditProfile(profile);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditProfile(null);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    startTransition(async () => {
      const res = await deleteICPProfile(deleteTarget.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("ICP profile deleted");
        router.refresh();
      }
      setIsDeleting(false);
      setDeleteTarget(null);
    });
  };

  const handleRecalculate = () => {
    startTransition(async () => {
      const res = await recalculateICPMatches();
      if ("error" in res && res.error) {
        toast.error(res.error);
      } else if ("total" in res) {
        toast.success(
          `Recalculated ${res.matched}/${res.total} leads`,
        );
        router.refresh();
      }
    });
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Page Header */}
      <PageHeader title="Ideal Customer Profiles">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRecalculate}
          disabled={isPending || profiles.length === 0}
          leftIcon={
            isPending ? (
              <CircleNotchIcon size={16} className="animate-spin" />
            ) : (
              <CrosshairIcon size={16} />
            )
          }
        >
          Recalculate Matches
        </Button>
        <Button
          size="sm"
          leftIcon={<PlusIcon size={16} />}
          onClick={handleCreate}
        >
          Create ICP Profile
        </Button>
      </PageHeader>

      {/* Insights Summary */}
      {insights && profiles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Leads"
            value={insights.totalLeads}
            icon={
              <CrosshairIcon
                size={24}
                className="text-neutral-500 dark:text-neutral-400"
              />
            }
          />
          <StatCard
            label="Matched Leads"
            value={insights.matchedLeads}
            icon={
              <CrosshairIcon
                size={24}
                className="text-neutral-500 dark:text-neutral-400"
              />
            }
            change={
              insights.totalLeads > 0
                ? {
                    value: `${Math.round(
                      (insights.matchedLeads / insights.totalLeads) * 100,
                    )}%`,
                    trend: "neutral",
                  }
                : undefined
            }
          />
          <StatCard
            label="Avg Match Score"
            value={insights.avgMatchScore > 0 ? `${insights.avgMatchScore}%` : "--"}
            icon={
              <CrosshairIcon
                size={24}
                className="text-neutral-500 dark:text-neutral-400"
              />
            }
          />
        </div>
      )}

      {/* Profile Cards */}
      {profiles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {profiles.map((profile) => (
            <ICPProfileCard
              key={profile.id}
              profile={profile}
              insights={insights}
              onEdit={() => handleEdit(profile)}
              onDelete={() => setDeleteTarget(profile)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<CrosshairIcon size={24} />}
          title="No ICP Profiles"
          description="Create your first Ideal Customer Profile to start matching leads and prioritizing your pipeline."
          actions={[
            {
              label: "Create ICP Profile",
              icon: <PlusIcon size={16} />,
              onClick: handleCreate,
            },
          ]}
        />
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <ICPProfileModal
          key={editProfile?.id ?? "new"}
          open={showModal}
          onClose={handleCloseModal}
          editProfile={editProfile}
        />
      )}

      {/* Delete Confirmation */}
      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete ICP Profile"
        itemName={deleteTarget?.name}
        loading={isDeleting}
      />
    </div>
  );
}
