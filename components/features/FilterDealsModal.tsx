"use client";

import { useState } from "react";
import { Modal, Button, Checkbox, XIcon } from "@/components/ui";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CloseDate = "any" | "this_week" | "this_month" | "this_quarter";
export type Probability = "low" | "medium" | "high";
export type Owner = "me" | "team";
export type DealValue = "any" | "10k" | "25k" | "50k";

export interface DealFilters {
  closeDate: CloseDate;
  probability: Probability[];
  owner: Owner[];
  dealValue: DealValue;
}

export const defaultFilters: DealFilters = {
  closeDate: "any",
  probability: [],
  owner: [],
  dealValue: "any",
};

export function getActiveFilterCount(filters: DealFilters): number {
  let count = 0;
  if (filters.closeDate !== "any") count++;
  if (filters.probability.length > 0) count++;
  if (filters.owner.length > 0) count++;
  if (filters.dealValue !== "any") count++;
  return count;
}

// ─── Radio Option ────────────────────────────────────────────────────────────

function RadioOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-sm text-left transition-colors",
        selected
          ? "border-neutral-950 dark:border-neutral-50 bg-neutral-50 dark:bg-neutral-800"
          : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700",
      )}
    >
      <div
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors shrink-0",
          selected
            ? "border-neutral-950 dark:border-neutral-50"
            : "border-neutral-300 dark:border-neutral-600",
        )}
      >
        {selected && (
          <div className="h-2.5 w-2.5 rounded-full bg-neutral-950 dark:bg-neutral-50" />
        )}
      </div>
      <span className="text-neutral-950 dark:text-neutral-50">{label}</span>
    </button>
  );
}

// ─── Checkbox Option ─────────────────────────────────────────────────────────

function CheckboxOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-sm text-left transition-colors",
        checked
          ? "border-neutral-950 dark:border-neutral-50 bg-neutral-50 dark:bg-neutral-800"
          : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700",
      )}
    >
      <Checkbox checked={checked} onChange={onChange} />
      <span className="text-neutral-950 dark:text-neutral-50">{label}</span>
    </button>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-3">
      {children}
    </p>
  );
}

// ─── Filter Modal ────────────────────────────────────────────────────────────

interface FilterDealsModalProps {
  open: boolean;
  onClose: () => void;
  filters: DealFilters;
  onApply: (filters: DealFilters) => void;
}

export function FilterDealsModal({
  open,
  onClose,
  filters,
  onApply,
}: FilterDealsModalProps) {
  const [local, setLocal] = useState<DealFilters>(filters);

  const toggleProbability = (value: Probability) => {
    setLocal((prev) => ({
      ...prev,
      probability: prev.probability.includes(value)
        ? prev.probability.filter((p) => p !== value)
        : [...prev.probability, value],
    }));
  };

  const toggleOwner = (value: Owner) => {
    setLocal((prev) => ({
      ...prev,
      owner: prev.owner.includes(value)
        ? prev.owner.filter((o) => o !== value)
        : [...prev.owner, value],
    }));
  };

  return (
    <Modal open={open} onClose={onClose} className="sm:max-w-2xl">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 p-5">
          <h2 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
            Filter Deals
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <XIcon size={20} className="text-neutral-500" />
          </button>
        </div>
        {/* Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6 p-5">
          {/* Close Date - Radio */}
          <div>
            <SectionLabel>Close Date</SectionLabel>
            <div className="space-y-2">
              <RadioOption
                label="Any time"
                selected={local.closeDate === "any"}
                onClick={() => setLocal((p) => ({ ...p, closeDate: "any" }))}
              />
              <RadioOption
                label="This week"
                selected={local.closeDate === "this_week"}
                onClick={() =>
                  setLocal((p) => ({ ...p, closeDate: "this_week" }))
                }
              />
              <RadioOption
                label="This Month"
                selected={local.closeDate === "this_month"}
                onClick={() =>
                  setLocal((p) => ({ ...p, closeDate: "this_month" }))
                }
              />
              <RadioOption
                label="This Quarter"
                selected={local.closeDate === "this_quarter"}
                onClick={() =>
                  setLocal((p) => ({ ...p, closeDate: "this_quarter" }))
                }
              />
            </div>
          </div>

          {/* Probability - Checkbox */}
          <div>
            <SectionLabel>Probability</SectionLabel>
            <div className="space-y-2">
              <CheckboxOption
                label="Low (0-30%)"
                checked={local.probability.includes("low")}
                onChange={() => toggleProbability("low")}
              />
              <CheckboxOption
                label="Medium (31-60%)"
                checked={local.probability.includes("medium")}
                onChange={() => toggleProbability("medium")}
              />
              <CheckboxOption
                label="High (61-100%)"
                checked={local.probability.includes("high")}
                onChange={() => toggleProbability("high")}
              />
            </div>
          </div>

          {/* Owner - Checkbox */}
          <div>
            <SectionLabel>Owner</SectionLabel>
            <div className="space-y-2">
              <CheckboxOption
                label="Me"
                checked={local.owner.includes("me")}
                onChange={() => toggleOwner("me")}
              />
              <CheckboxOption
                label="Team Members"
                checked={local.owner.includes("team")}
                onChange={() => toggleOwner("team")}
              />
            </div>
          </div>

          {/* Deal Value - Radio */}
          <div>
            <SectionLabel>Deal Value</SectionLabel>
            <div className="space-y-2">
              <RadioOption
                label="Any Value"
                selected={local.dealValue === "any"}
                onClick={() => setLocal((p) => ({ ...p, dealValue: "any" }))}
              />
              <RadioOption
                label="$10,000+"
                selected={local.dealValue === "10k"}
                onClick={() => setLocal((p) => ({ ...p, dealValue: "10k" }))}
              />
              <RadioOption
                label="$25,000+"
                selected={local.dealValue === "25k"}
                onClick={() => setLocal((p) => ({ ...p, dealValue: "25k" }))}
              />
              <RadioOption
                label="$50,000+"
                selected={local.dealValue === "50k"}
                onClick={() => setLocal((p) => ({ ...p, dealValue: "50k" }))}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 p-5">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply(local);
              onClose();
            }}
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </Modal>
  );
}
