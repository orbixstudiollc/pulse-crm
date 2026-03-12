"use client";

import { useState, useEffect, useTransition } from "react";
import { Modal, Button, Checkbox, TagInput, XIcon } from "@/components/ui";
import { Faders, Warning } from "@phosphor-icons/react";
import { upsertScoringProfile } from "@/lib/actions/scoring";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface ScoringConfigModalProps {
  open: boolean;
  onClose: () => void;
  profile: {
    id: string;
    name: string;
    weight_company_size: number;
    weight_industry_fit: number;
    weight_engagement: number;
    weight_source_quality: number;
    weight_budget: number;
    target_industries: string[];
    target_company_sizes: string[];
    source_rankings: Record<string, number>;
  } | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const companySizeOptions = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5000+",
] as const;

const defaultSources: Array<{ key: string; label: string }> = [
  { key: "Website", label: "Website" },
  { key: "Referral", label: "Referral" },
  { key: "LinkedIn", label: "LinkedIn" },
  { key: "Event", label: "Event" },
  { key: "Google Ads", label: "Google Ads" },
  { key: "Cold Call", label: "Cold Call" },
];

// ── Section Header ───────────────────────────────────────────────────────────

function SectionLabel({
  children,
  description,
}: {
  children: string;
  description?: string;
}) {
  return (
    <div className="mb-3">
      <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
        {children}
      </p>
      {description && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          {description}
        </p>
      )}
    </div>
  );
}

// ── Weight Slider ────────────────────────────────────────────────────────────

function WeightSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="text-sm text-neutral-950 dark:text-neutral-50 w-32 shrink-0">
        {label}
      </label>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 appearance-none rounded-full bg-neutral-200 dark:bg-neutral-700 accent-neutral-950 dark:accent-neutral-50 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-neutral-950 dark:[&::-webkit-slider-thumb]:bg-neutral-50"
      />
      <span className="text-sm tabular-nums font-medium text-neutral-950 dark:text-neutral-50 w-10 text-right">
        {value}%
      </span>
    </div>
  );
}

// ── Source Slider ────────────────────────────────────────────────────────────

function SourceSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="text-sm text-neutral-950 dark:text-neutral-50 w-28 shrink-0">
        {label}
      </label>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 appearance-none rounded-full bg-neutral-200 dark:bg-neutral-700 accent-neutral-950 dark:accent-neutral-50 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-neutral-950 dark:[&::-webkit-slider-thumb]:bg-neutral-50"
      />
      <span className="text-sm tabular-nums text-neutral-500 dark:text-neutral-400 w-7 text-right">
        {value}
      </span>
    </div>
  );
}

// ── Modal Component ──────────────────────────────────────────────────────────

export function ScoringConfigModal({
  open,
  onClose,
  profile,
}: ScoringConfigModalProps) {
  const [isPending, startTransition] = useTransition();

  // Weights
  const [weightCompanySize, setWeightCompanySize] = useState(20);
  const [weightIndustryFit, setWeightIndustryFit] = useState(25);
  const [weightEngagement, setWeightEngagement] = useState(20);
  const [weightSourceQuality, setWeightSourceQuality] = useState(15);
  const [weightBudget, setWeightBudget] = useState(20);

  // Targets
  const [targetIndustries, setTargetIndustries] = useState<string[]>([]);
  const [targetCompanySizes, setTargetCompanySizes] = useState<string[]>([]);

  // Source rankings
  const [sourceRankings, setSourceRankings] = useState<Record<string, number>>({
    Website: 70,
    Referral: 90,
    LinkedIn: 60,
    Event: 75,
    "Google Ads": 50,
    "Cold Call": 30,
  });

  // Sync state from profile when it changes
  useEffect(() => {
    if (profile) {
      setWeightCompanySize(profile.weight_company_size);
      setWeightIndustryFit(profile.weight_industry_fit);
      setWeightEngagement(profile.weight_engagement);
      setWeightSourceQuality(profile.weight_source_quality);
      setWeightBudget(profile.weight_budget);
      setTargetIndustries(profile.target_industries ?? []);
      setTargetCompanySizes(profile.target_company_sizes ?? []);
      setSourceRankings(
        profile.source_rankings && Object.keys(profile.source_rankings).length > 0
          ? profile.source_rankings
          : {
              Website: 70,
              Referral: 90,
              LinkedIn: 60,
              Event: 75,
              "Google Ads": 50,
              "Cold Call": 30,
            },
      );
    }
  }, [profile]);

  const weightSum =
    weightCompanySize +
    weightIndustryFit +
    weightEngagement +
    weightSourceQuality +
    weightBudget;

  const isWeightValid = weightSum === 100;

  const toggleCompanySize = (size: string) => {
    setTargetCompanySizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size],
    );
  };

  const updateSourceRanking = (key: string, value: number) => {
    setSourceRankings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!isWeightValid) return;

    startTransition(async () => {
      const result = await upsertScoringProfile({
        weight_company_size: weightCompanySize,
        weight_industry_fit: weightIndustryFit,
        weight_engagement: weightEngagement,
        weight_source_quality: weightSourceQuality,
        weight_budget: weightBudget,
        target_industries: targetIndustries,
        target_company_sizes: targetCompanySizes,
        source_rankings: sourceRankings,
      });

      if (result.error) {
        toast.error("Failed to save scoring configuration");
      } else {
        toast.success("Scoring configuration saved");
        onClose();
      }
    });
  };

  return (
    <Modal open={open} onClose={onClose} className="sm:max-w-2xl">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <Faders size={18} className="text-neutral-600 dark:text-neutral-400" />
            </div>
            <div>
              <h2 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
                Scoring Configuration
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {profile?.name ?? "Default"} profile
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <XIcon size={20} className="text-neutral-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-6">
          {/* ── Weight Sliders ──────────────────────────────────── */}
          <div>
            <SectionLabel description="Weights must add up to 100%">
              Score Weights
            </SectionLabel>

            <div className="space-y-3">
              <WeightSlider
                label="Company Size"
                value={weightCompanySize}
                onChange={setWeightCompanySize}
              />
              <WeightSlider
                label="Industry Fit"
                value={weightIndustryFit}
                onChange={setWeightIndustryFit}
              />
              <WeightSlider
                label="Engagement"
                value={weightEngagement}
                onChange={setWeightEngagement}
              />
              <WeightSlider
                label="Source Quality"
                value={weightSourceQuality}
                onChange={setWeightSourceQuality}
              />
              <WeightSlider
                label="Budget"
                value={weightBudget}
                onChange={setWeightBudget}
              />
            </div>

            {/* Weight sum indicator */}
            <div
              className={cn(
                "mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                isWeightValid
                  ? "bg-green-50 dark:bg-green-400/10 text-green-700 dark:text-green-400"
                  : "bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-400",
              )}
            >
              {!isWeightValid && <Warning size={16} weight="fill" />}
              <span className="tabular-nums font-medium">
                Total: {weightSum}%
              </span>
              {!isWeightValid && (
                <span className="text-xs ml-1">
                  ({weightSum > 100 ? `${weightSum - 100}% over` : `${100 - weightSum}% remaining`})
                </span>
              )}
            </div>
          </div>

          {/* ── Target Industries ───────────────────────────────── */}
          <div>
            <SectionLabel description="Industries you want to target">
              Target Industries
            </SectionLabel>
            <TagInput
              tags={targetIndustries}
              onChange={setTargetIndustries}
              placeholder="e.g. SaaS, FinTech, Healthcare..."
            />
          </div>

          {/* ── Target Company Sizes ────────────────────────────── */}
          <div>
            <SectionLabel description="Select ideal company sizes">
              Target Company Sizes
            </SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {companySizeOptions.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => toggleCompanySize(size)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm text-left transition-colors",
                    targetCompanySizes.includes(size)
                      ? "border-neutral-950 dark:border-neutral-50 bg-neutral-50 dark:bg-neutral-800"
                      : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700",
                  )}
                >
                  <Checkbox
                    checked={targetCompanySizes.includes(size)}
                    onChange={() => toggleCompanySize(size)}
                  />
                  <span className="text-neutral-950 dark:text-neutral-50">
                    {size}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Source Rankings ──────────────────────────────────── */}
          <div>
            <SectionLabel description="Rate lead quality by source (0-100)">
              Source Rankings
            </SectionLabel>
            <div className="space-y-3">
              {defaultSources.map((source) => (
                <SourceSlider
                  key={source.key}
                  label={source.label}
                  value={sourceRankings[source.key] ?? 50}
                  onChange={(v) => updateSourceRanking(source.key, v)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 p-5">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isWeightValid || isPending}
          >
            {isPending ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
