"use client";

import Image from "next/image";
import { Drawer, Button, ArrowRightIcon } from "@/components/ui";
import {
  type PipelineDeal,
  type PipelineStage,
  activeStageOrder,
  getStageLabel,
  formatDealCurrency,
} from "@/lib/data/sales";
import { cn } from "@/lib/utils";

interface DealDrawerProps {
  open: boolean;
  onClose: () => void;
  deal: PipelineDeal | null;
}

// ─── Stage Progress ──────────────────────────────────────────────────────────

function StageProgress({ currentStage }: { currentStage: PipelineStage }) {
  const currentIndex = activeStageOrder.indexOf(
    currentStage === "closed_lost" ? "closed_won" : currentStage,
  );
  const isLost = currentStage === "closed_lost";

  return (
    <div className="flex gap-1.5">
      {activeStageOrder.map((stage, index) => {
        const isFilled = index <= currentIndex && !isLost;
        const isLostFilled = isLost && index <= currentIndex;

        return (
          <div
            key={stage}
            className={cn(
              "h-2 flex-1 rounded-full transition-colors",
              isFilled
                ? "bg-neutral-950 dark:bg-neutral-50"
                : isLostFilled
                  ? "bg-red-500"
                  : "bg-neutral-200 dark:bg-neutral-700",
            )}
          />
        );
      })}
    </div>
  );
}

// ─── Info Row ────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
        {value}
      </span>
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: string }) {
  return (
    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
      {children}
    </p>
  );
}

// ─── Deal Drawer ─────────────────────────────────────────────────────────────

export function DealDrawer({ open, onClose, deal }: DealDrawerProps) {
  if (!deal) return null;

  const isClosed = deal.stage === "closed_won" || deal.stage === "closed_lost";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Deal Details"
      footer={
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-300 dark:hover:border-red-500/40"
            onClick={onClose}
          >
            Mark Lost
          </Button>
          <Button className="flex-1" rightIcon={<ArrowRightIcon size={18} />}>
            View Details
          </Button>
        </div>
      }
    >
      {/* Deal Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-2xl font-serif text-neutral-950 dark:text-neutral-50">
            {deal.name}
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {deal.company}
          </p>
        </div>
        <p className="text-2xl font-serif text-neutral-950 dark:text-neutral-50">
          {formatDealCurrency(deal.value)}
        </p>
      </div>

      {/* Deal Stage */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader>Deal Stage</SectionHeader>
          <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
            {getStageLabel(deal.stage)}
          </span>
        </div>
        <StageProgress currentStage={deal.stage} />
      </div>

      {/* Deal Information */}
      <div className="mb-6">
        <SectionHeader>Deal Information</SectionHeader>
        <div className="divide-y-[0.5px] divide-neutral-200 dark:divide-neutral-800">
          <InfoRow label="Probability" value={`${deal.probability}%`} />
          <InfoRow label="Expected Close" value={deal.closeDate} />
          <InfoRow label="Created" value={deal.createdDate} />
          <InfoRow label="Last Activity" value={deal.lastActivity} />
        </div>
      </div>

      {/* Contact */}
      <div className="mb-6">
        <SectionHeader>Contact</SectionHeader>
        <div className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700">
              <Image
                src={deal.contact.avatar}
                alt={deal.contact.name}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                {deal.contact.name}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {deal.contact.email}
              </p>
            </div>
          </div>
          <button className="text-sm font-medium text-neutral-950 dark:text-neutral-50 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
            View
          </button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <SectionHeader>Notes</SectionHeader>
        <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/50 p-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            {deal.notes}
          </p>
        </div>
      </div>
    </Drawer>
  );
}
