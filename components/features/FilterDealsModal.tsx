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
  search: string;
  closeDate: CloseDate;
  probability: Probability[];
  owner: Owner[];
  dealValue: DealValue;
}

export const defaultFilters: DealFilters = {
  search: "",
  closeDate: "any",
  probability: [],
  owner: [],
  dealValue: "any",
};

export function getActiveFilterCount(filters: DealFilters): number {
  let count = 0;
  if (filters.search?.trim()) count++;
  if (filters.closeDate && filters.closeDate !== "any") count++;
  if (filters.probability?.length > 0) count++;
  if (filters.owner?.length > 0) count++;
  if (filters.dealValue && filters.dealValue !== "any") count++;
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
        "flex items-center gap-3 w-full rounded-md border px-3 py-2 text-sm text-left transition-colors",
        selected
          ? "border-inverse bg-subtle"
          : "border-line hover:border-fg-muted",
      )}
    >
      <div
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full border transition-colors shrink-0",
          selected
            ? "border-inverse"
            : "border-line",
        )}
      >
        {selected && (
          <div className="h-2.5 w-2.5 rounded-full bg-inverse" />
        )}
      </div>
      <span className="text-fg">{label}</span>
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
        "flex items-center gap-3 w-full rounded-md border px-3 py-2 text-sm text-left transition-colors",
        checked
          ? "border-inverse bg-subtle"
          : "border-line hover:border-fg-muted",
      )}
    >
      <Checkbox checked={checked} onChange={onChange} />
      <span className="text-fg">{label}</span>
    </button>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-sm font-medium text-fg mb-3">
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
        <div className="flex h-12 items-center justify-between border-b border-divider px-4">
          <h2 className="text-heading-md text-fg">
            Filter Deals
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
          >
            <XIcon size={20} className="text-fg-secondary" />
          </button>
        </div>
        {/* Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6 p-4">
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
        <div className="flex items-center justify-end gap-2 border-t border-divider bg-subtle px-4 py-3">
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
