"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LightningIcon, XIcon, CircleNotchIcon, Button } from "@/components/ui";
import { Progress } from "@/components/ui/Progress";

// ── localStorage-based active batch registry ──────────────────────────────

const STORAGE_KEY = "activeBatchId";
const POLL_INTERVAL_MS = 2000;

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

interface BatchUpdateEvent {
  batchId: string;
  campaignId: string | null;
  total: number;
  completed: number;
  failed: number;
  status: string;
}

interface EnrichmentProgressBannerProps {
  /**
   * When provided, the banner scopes its SSE subscription to this campaign
   * id. When omitted, it listens to org-wide events.
   */
  campaignId?: string;
  /**
   * Optional initial batch id. Callers that just kicked off an enrichment
   * (e.g. bulk-enrich) can pass the returned batchId so the banner latches
   * on immediately instead of waiting for the first SSE event.
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedSignalled = useRef<string | null>(null);

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

  // ── Subscribe to SSE ────────────────────────────────────────────────────

  useEffect(() => {
    const url = campaignId
      ? `/api/lead-finder/events?campaignId=${campaignId}`
      : `/api/lead-finder/events`;
    const es = new EventSource(url);

    const onBatchUpdate = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as BatchUpdateEvent;

        setBatchId((prev) => {
          // Latch on to whatever batch is active if we don't have one, OR
          // if the previously tracked batch is finished and a new one is
          // starting.
          if (!prev) return data.batchId;
          return prev;
        });

        setStatus((prev) => {
          if (!prev || prev.id !== data.batchId) return prev;
          return {
            ...prev,
            done: data.completed,
            failed: data.failed,
            total: data.total,
            status: data.status,
          };
        });

        // Unhide the banner when a new batch comes in.
        setDismissed(false);
      } catch {
        /* swallow */
      }
    };

    es.addEventListener(
      "enrichment-batch:updated",
      onBatchUpdate as EventListener
    );

    return () => {
      es.removeEventListener(
        "enrichment-batch:updated",
        onBatchUpdate as EventListener
      );
      es.close();
    };
  }, [campaignId]);

  // ── Poll the batch endpoint while active ───────────────────────────────

  useEffect(() => {
    if (!batchId) return;

    let cancelled = false;

    const load = async () => {
      const fresh = await fetchBatchStatus(batchId);
      if (cancelled || !fresh) return;
      setStatus(fresh);
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
      className={`rounded-xl border bg-white dark:bg-neutral-900 p-4 ${
        status.status === "cancelled"
          ? "border-amber-300 dark:border-amber-800"
          : status.status === "done"
            ? "border-green-300 dark:border-green-800"
            : "border-blue-300 dark:border-blue-800"
      } ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            status.status === "cancelled"
              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
              : status.status === "done"
                ? "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400"
                : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
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
              <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                {title}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
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
