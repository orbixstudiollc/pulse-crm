"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LightningIcon, XIcon, CircleNotchIcon, Button } from "@/components/ui";
import { Progress } from "@/components/ui/Progress";

// ── localStorage-based active batch registry ──────────────────────────────

const STORAGE_KEY = "activeBatchId";
const POLL_INTERVAL_MS = 2000;
const STATUS_POLL_INTERVAL_MS = 5000;

/**
 * Call this after a successful POST that enqueues an enrichment batch
 * (e.g. /api/lead-finder/leads/bulk-enrich or /campaigns/[id]/enrich).
 * The layout-level banner picks it up via localStorage and starts polling.
 */
export function registerActiveBatch(batchId: string | number): void {
  if (typeof window === "undefined") return;
  const value = String(batchId);
  localStorage.setItem(STORAGE_KEY, value);
  // storage events only fire in OTHER tabs — dispatch one manually so the
  // banner in this tab picks it up immediately.
  window.dispatchEvent(
    new StorageEvent("storage", { key: STORAGE_KEY, newValue: value })
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

interface BatchStatus {
  id: string;
  campaignId: string | null;
  label: string | null;
  status: string;
  total: number;
  done: number;
  failed: number;
  running: number;
  queued: number;
  etaSeconds: number | null;
  startedAt: string | null;
  finishedAt: string | null;
}

interface EnrichmentStatusBatch {
  id: string;
  campaignId: string | null;
  total: number;
  done: number;
  failed: number;
  status: string;
}

interface EnrichmentStatusResponse {
  active: boolean;
  batches: EnrichmentStatusBatch[];
}

interface EnrichmentProgressBannerProps {
  /**
   * When provided, the banner only picks up batches for this campaign id.
   * When omitted, it considers every batch in the org.
   */
  campaignId?: string;
  /**
   * Optional initial batch id. Callers that just kicked off an enrichment
   * (e.g. bulk-enrich) can pass the returned batchId so the banner latches
   * on immediately instead of waiting for the next status poll.
   */
  batchId?: string | null;
  /**
   * Fired when the banner observes a completed (or cancelled) batch. Parent
   * pages typically use this to refresh counts.
   */
  onBatchFinished?: (batchId: string) => void;
  className?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatEta(seconds: number | null): string {
  if (seconds == null || seconds < 0) return "\u2014";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ${seconds % 60}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function isTerminal(status: string): boolean {
  return status === "done" || status === "cancelled";
}

async function fetchEnrichmentStatus(): Promise<EnrichmentStatusResponse | null> {
  try {
    const res = await fetch("/api/lead-finder/enrichment-status");
    if (!res.ok) return null;
    return (await res.json()) as EnrichmentStatusResponse;
  } catch {
    return null;
  }
}

async function fetchBatchStatus(id: string): Promise<BatchStatus | null> {
  try {
    const res = await fetch(`/api/lead-finder/enrichment-batches/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as BatchStatus;
  } catch {
    return null;
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export function EnrichmentProgressBanner({
  campaignId,
  batchId: initialBatchId = null,
  onBatchFinished,
  className,
}: EnrichmentProgressBannerProps) {
  const [batchId, setBatchId] = useState<string | null>(() => {
    if (initialBatchId) return initialBatchId;
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });
  const [status, setStatus] = useState<BatchStatus | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedSignalled = useRef<string | null>(null);
  const batchIdRef = useRef<string | null>(batchId);
  const statusRef = useRef<BatchStatus | null>(status);

  useEffect(() => {
    batchIdRef.current = batchId;
    statusRef.current = status;
  }, [batchId, status]);

  // When the caller provides a new initial batchId, latch on immediately.
  useEffect(() => {
    if (initialBatchId) {
      setBatchId(initialBatchId);
      setDismissed(false);
      finishedSignalled.current = null;
    }
  }, [initialBatchId]);

  // Listen for cross-tab + same-tab registerActiveBatch() calls so the
  // layout-level banner latches on without a prop being passed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = e.newValue || null;
      if (next) {
        setBatchId(next);
        setDismissed(false);
        finishedSignalled.current = null;
      } else {
        setBatchId(null);
        setStatus(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ── Poll org-wide enrichment status ────────────────────────────────────
  // Works across serverless instances (reads the DB), unlike an in-memory
  // event stream. Runs once on mount / when the tracked batch changes, when
  // the tab becomes visible, and every few seconds only while a batch is active.

  const refreshStatus = useCallback(async () => {
    const data = await fetchEnrichmentStatus();
    if (!data) return;
    const batches = campaignId
      ? data.batches.filter((b) => b.campaignId === campaignId)
      : data.batches;
    const running = batches.find((b) => !isTerminal(b.status));
    setActive(!!running);

    // Latch on to an active batch if we don't track one, or if the tracked
    // batch has finished and a new one is starting.
    const tracked = batchIdRef.current;
    const trackedStatus = statusRef.current;
    const trackedFinished =
      !!trackedStatus &&
      trackedStatus.id === tracked &&
      isTerminal(trackedStatus.status);
    if (running && running.id !== tracked && (!tracked || trackedFinished)) {
      setBatchId(running.id);
      setStatus(null);
      setDismissed(false);
      finishedSignalled.current = null;
      return;
    }

    setStatus((prev) => {
      if (!prev) return prev;
      const match = batches.find((b) => b.id === prev.id);
      if (!match) return prev;
      return {
        ...prev,
        done: match.done,
        failed: match.failed,
        total: match.total,
        status: match.status,
      };
    });
  }, [campaignId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus, batchId]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshStatus();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refreshStatus]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      void refreshStatus();
    }, STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [active, refreshStatus]);

  // ── Poll the tracked batch's details until it finishes ─────────────────

  useEffect(() => {
    if (!batchId) return;

    let cancelled = false;

    const load = async () => {
      const fresh = await fetchBatchStatus(batchId);
      if (cancelled || !fresh) return;
      setStatus(fresh);
      if (isTerminal(fresh.status) && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    void load();

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [batchId]);

  // ── Auto-dismiss on completion ─────────────────────────────────────────

  useEffect(() => {
    if (!status) return;
    const done = status.status === "done" || status.status === "cancelled";
    if (done && finishedSignalled.current !== status.id) {
      finishedSignalled.current = status.id;
      onBatchFinished?.(status.id);
      // Release the localStorage latch so the next bulk-enrich can re-arm
      // this (or another) banner.
      if (typeof window !== "undefined" &&
          localStorage.getItem(STORAGE_KEY) === status.id) {
        localStorage.removeItem(STORAGE_KEY);
      }
      const t = setTimeout(() => setDismissed(true), 3_000);
      return () => clearTimeout(t);
    }
  }, [status, onBatchFinished]);

  // ── Cancel ──────────────────────────────────────────────────────────────

  const handleCancel = useCallback(async () => {
    if (!batchId) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/lead-finder/enrichment-batches/${batchId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data?.error === "string" ? data.error : "Failed to cancel"
        );
      }
      toast.success("Enrichment batch cancelled");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to cancel enrichment"
      );
    } finally {
      setCancelling(false);
    }
  }, [batchId]);

  if (!batchId || !status || dismissed) return null;

  const { total, done, failed, running, queued, etaSeconds, label } = status;
  const percent = total > 0 ? Math.round(((done + failed) / total) * 100) : 0;
  const isActive = status.status !== "done" && status.status !== "cancelled";

  const title =
    status.status === "cancelled"
      ? "Enrichment cancelled"
      : status.status === "done"
        ? "Enrichment complete"
        : label || "Enrichment in progress";

  return (
    <div
      className={`rounded-lg border bg-surface p-4 ${
        status.status === "cancelled"
          ? "border-warning"
          : status.status === "done"
            ? "border-success"
            : "border-line"
      } ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            status.status === "cancelled"
              ? "bg-warning-surface text-warning"
              : status.status === "done"
                ? "bg-success-surface text-success"
                : "bg-accent-surface text-accent-on-surface"
          }`}
        >
          {isActive ? (
            <CircleNotchIcon size={16} className="animate-spin" />
          ) : (
            <LightningIcon size={16} />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg">
                {title}
              </p>
              <p className="text-xs text-fg-secondary">
                {done} of {total} done{failed > 0 ? ` — ${failed} failed` : ""}
                {running > 0 ? ` — ${running} running` : ""}
                {queued > 0 ? ` — ${queued} queued` : ""}
                {etaSeconds != null && isActive
                  ? ` — ETA ${formatEta(etaSeconds)}`
                  : ""}
              </p>
            </div>
            {isActive ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={cancelling}
                leftIcon={
                  cancelling ? (
                    <CircleNotchIcon size={12} className="animate-spin" />
                  ) : (
                    <XIcon size={12} />
                  )
                }
              >
                Cancel
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss"
              >
                <XIcon size={14} />
              </Button>
            )}
          </div>
          <Progress
            value={percent}
            max={100}
            color={
              status.status === "cancelled"
                ? "amber"
                : status.status === "done"
                  ? "green"
                  : "blue"
            }
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}
