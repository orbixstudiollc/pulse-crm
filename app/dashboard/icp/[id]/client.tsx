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
  CrosshairIcon,
  ArrowLeftIcon,
  PencilSimpleIcon,
  CircleNotchIcon,
} from "@/components/ui";
import { PageHeader } from "@/components/dashboard";
import {
  updateICPProfile,
  recalculateICPMatches,
  type ICPCriteria,
  type ICPWeights,
} from "@/lib/actions/icp";
import { cn, formatCurrency } from "@/lib/utils";

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

interface MatchedLead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  industry: string | null;
  employees: string | null;
  estimated_value: number;
  icp_match_score: number | null;
  icp_match_breakdown: unknown;
  status: string;
}

interface ICPDetailClientProps {
  profile: ICPProfile;
  matchedLeads: MatchedLead[];
}

// ── Defaults ──────────────────────────────────────────────────────────────────

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

const defaultCriteria: ICPCriteria = {
  firmographic: {
    industries: [],
    company_sizes: [],
    employee_range: { min: null, max: null },
    geography: [],
  },
  technographic: { tech_stack: [], tech_sophistication_min: 0 },
  behavioral: { buying_patterns: [], trigger_events: [] },
  pain_points: [],
  budget: {
    revenue_range: { min: null, max: null },
    deal_size_sweet_spot: null,
    funding_stages: [],
  },
  channel: { preferred_contact_methods: [], content_preferences: [] },
};

const defaultWeights: ICPWeights = {
  industry: 25,
  size: 20,
  revenue: 15,
  title: 15,
  geography: 15,
  tech: 10,
};

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

function getGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function getGradeVariant(grade: string): "green" | "blue" | "amber" | "red" {
  if (grade === "A+" || grade === "A") return "green";
  if (grade === "B") return "blue";
  if (grade === "C") return "amber";
  return "red";
}

// ── Weight labels ─────────────────────────────────────────────────────────────

const weightLabels: Record<keyof ICPWeights, string> = {
  industry: "Industry",
  size: "Company Size",
  revenue: "Revenue",
  title: "Title / Role",
  geography: "Geography",
  tech: "Technology",
};

const weightColors: Record<keyof ICPWeights, string> = {
  industry: "bg-blue-500",
  size: "bg-emerald-500",
  revenue: "bg-amber-500",
  title: "bg-violet-500",
  geography: "bg-rose-500",
  tech: "bg-cyan-500",
};

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditProfileModal({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: ICPProfile;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const editCriteria = parseCriteria(profile.criteria);
  const editWeights = parseWeights(profile.weights);

  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description ?? "");
  const [color, setColor] = useState(profile.color ?? "#6366f1");
  const [isPrimary, setIsPrimary] = useState(profile.is_primary);
  const [industries, setIndustries] = useState<string[]>(editCriteria.firmographic.industries);
  const [companySizes, setCompanySizes] = useState<string[]>(editCriteria.firmographic.company_sizes);
  const [geography, setGeography] = useState<string[]>(editCriteria.firmographic.geography);
  const [revenueMin, setRevenueMin] = useState<string>(
    editCriteria.budget.revenue_range.min?.toString() ?? "",
  );
  const [revenueMax, setRevenueMax] = useState<string>(
    editCriteria.budget.revenue_range.max?.toString() ?? "",
  );
  const [dealSizeSweetSpot, setDealSizeSweetSpot] = useState<string>(
    editCriteria.budget.deal_size_sweet_spot?.toString() ?? "",
  );
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
      technographic: { tech_stack: [], tech_sophistication_min: 0 },
      behavioral: { buying_patterns: [], trigger_events: [] },
      pain_points: [],
      budget: {
        revenue_range: {
          min: revenueMin ? Number(revenueMin) : null,
          max: revenueMax ? Number(revenueMax) : null,
        },
        deal_size_sweet_spot: dealSizeSweetSpot ? Number(dealSizeSweetSpot) : null,
        funding_stages: [],
      },
      channel: { preferred_contact_methods: [], content_preferences: [] },
    };

    startTransition(async () => {
      const res = await updateICPProfile(profile.id, {
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
    });
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-2xl">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50 mb-6">
          Edit ICP Profile
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

          {/* Firmographic */}
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

          {/* Budget */}
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
            {isPending ? "Saving..." : "Update Profile"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Criteria Section ──────────────────────────────────────────────────────────

function CriteriaSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; values: string[] }>;
}) {
  const hasContent = items.some((item) => item.values.length > 0);

  if (!hasContent) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50 uppercase tracking-wide">
        {title}
      </h4>
      <div className="space-y-2">
        {items.map(
          (item) =>
            item.values.length > 0 && (
              <div key={item.label} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-neutral-500 dark:text-neutral-400 min-w-[80px]">
                  {item.label}:
                </span>
                {item.values.map((v) => (
                  <Badge key={v} variant="neutral">
                    {v}
                  </Badge>
                ))}
              </div>
            ),
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ICPDetailClient({ profile, matchedLeads }: ICPDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showEditModal, setShowEditModal] = useState(false);

  const criteria = parseCriteria(profile.criteria);
  const weights = parseWeights(profile.weights);

  const handleRecalculate = () => {
    startTransition(async () => {
      const res = await recalculateICPMatches();
      if ("error" in res && res.error) {
        toast.error(res.error);
      } else if ("total" in res) {
        toast.success(`Recalculated ${res.matched}/${res.total} leads`);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/icp"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors w-fit"
        >
          <ArrowLeftIcon size={14} />
          Back to ICP Profiles
        </Link>

        <PageHeader title={profile.name}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRecalculate}
            disabled={isPending}
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
            variant="outline"
            size="sm"
            leftIcon={<PencilSimpleIcon size={16} />}
            onClick={() => setShowEditModal(true)}
          >
            Edit Profile
          </Button>
        </PageHeader>
      </div>

      {/* Profile Header Card */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
        <div className="flex items-center gap-4 mb-4">
          <div
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: profile.color ?? "#6366f1" }}
          />
          <h2 className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">
            {profile.name}
          </h2>
          {profile.is_primary && (
            <Badge variant="violet" dot>
              Primary
            </Badge>
          )}
        </div>
        {profile.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {profile.description}
          </p>
        )}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Criteria */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
            <h3 className="text-base font-semibold text-neutral-950 dark:text-neutral-50 mb-6">
              Criteria
            </h3>
            <div className="space-y-6">
              <CriteriaSection
                title="Firmographic"
                items={[
                  { label: "Industries", values: criteria.firmographic.industries },
                  { label: "Sizes", values: criteria.firmographic.company_sizes },
                  { label: "Geography", values: criteria.firmographic.geography },
                ]}
              />
              <CriteriaSection
                title="Technographic"
                items={[
                  { label: "Tech Stack", values: criteria.technographic.tech_stack },
                ]}
              />
              <CriteriaSection
                title="Behavioral"
                items={[
                  { label: "Buying Patterns", values: criteria.behavioral.buying_patterns },
                  { label: "Trigger Events", values: criteria.behavioral.trigger_events },
                ]}
              />
              <CriteriaSection
                title="Budget"
                items={[
                  {
                    label: "Revenue Range",
                    values:
                      criteria.budget.revenue_range.min !== null ||
                      criteria.budget.revenue_range.max !== null
                        ? [
                            `${
                              criteria.budget.revenue_range.min
                                ? formatCurrency(criteria.budget.revenue_range.min)
                                : "$0"
                            } - ${
                              criteria.budget.revenue_range.max
                                ? formatCurrency(criteria.budget.revenue_range.max)
                                : "No limit"
                            }`,
                          ]
                        : [],
                  },
                  {
                    label: "Sweet Spot",
                    values: criteria.budget.deal_size_sweet_spot
                      ? [formatCurrency(criteria.budget.deal_size_sweet_spot)]
                      : [],
                  },
                  { label: "Funding Stages", values: criteria.budget.funding_stages },
                ]}
              />
              <CriteriaSection
                title="Channel"
                items={[
                  { label: "Contact Methods", values: criteria.channel.preferred_contact_methods },
                  { label: "Content Prefs", values: criteria.channel.content_preferences },
                ]}
              />
              {criteria.pain_points.length > 0 && (
                <CriteriaSection
                  title="Pain Points"
                  items={criteria.pain_points.map((p) => ({
                    label: p.name,
                    values: [`Severity: ${p.severity}/10`],
                  }))}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right: Weights */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
            <h3 className="text-base font-semibold text-neutral-950 dark:text-neutral-50 mb-6">
              Weight Distribution
            </h3>
            <div className="space-y-4">
              {(Object.keys(weights) as Array<keyof ICPWeights>).map((key) => (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">
                      {weightLabels[key]}
                    </span>
                    <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                      {weights[key]}%
                    </span>
                  </div>
                  <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", weightColors[key])}
                      style={{ width: `${weights[key]}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
            <h3 className="text-base font-semibold text-neutral-950 dark:text-neutral-50 mb-4">
              Match Summary
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  Total Matched
                </span>
                <span className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                  {matchedLeads.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  Avg Score
                </span>
                <span className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                  {matchedLeads.length > 0
                    ? `${Math.round(
                        matchedLeads.reduce(
                          (sum, l) => sum + (l.icp_match_score ?? 0),
                          0,
                        ) / matchedLeads.length,
                      )}%`
                    : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  A+ Leads
                </span>
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {matchedLeads.filter((l) => (l.icp_match_score ?? 0) >= 90).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Matched Leads Table */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
            Matched Leads ({matchedLeads.length})
          </h3>
        </div>

        {matchedLeads.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="text-left text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400 px-6 py-3">
                    Name
                  </th>
                  <th className="text-left text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400 px-6 py-3">
                    Company
                  </th>
                  <th className="text-left text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400 px-6 py-3">
                    Match Score
                  </th>
                  <th className="text-left text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400 px-6 py-3">
                    Industry
                  </th>
                  <th className="text-left text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400 px-6 py-3">
                    Employees
                  </th>
                  <th className="text-right text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400 px-6 py-3">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {matchedLeads.map((lead) => {
                  const score = lead.icp_match_score ?? 0;
                  const grade = getGrade(score);
                  const gradeVariant = getGradeVariant(grade);

                  return (
                    <tr
                      key={lead.id}
                      className="border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                    >
                      <td className="px-6 py-3">
                        <div>
                          <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                            {lead.name}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {lead.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                        {lead.company || "--"}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                            {score}%
                          </span>
                          <Badge variant={gradeVariant}>{grade}</Badge>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                        {lead.industry || "--"}
                      </td>
                      <td className="px-6 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                        {lead.employees || "--"}
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-medium text-neutral-950 dark:text-neutral-50">
                        {formatCurrency(lead.estimated_value)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No leads matched to this profile yet. Run &ldquo;Recalculate Matches&rdquo; to score
              leads against this profile.
            </p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditProfileModal
          key={profile.id}
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          profile={profile}
        />
      )}
    </div>
  );
}
