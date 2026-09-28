/**
 * Next.js instrumentation hook — runs once when the server starts.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Boots the durable Lead Finder background worker so any enrichment jobs left
 * in `queued`, `running`, or `retry` status by a previous process are drained
 * automatically. The worker itself is HMR-safe (singleton on `globalThis`), so
 * calling `workerPump()` repeatedly is idempotent.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { workerPump } = await import("./lib/lead-finder/enrichment/worker");
    workerPump();
  } catch (err) {
    // Never crash the server if the worker fails to boot — the cron and
    // per-request `workerPump()` kicks will still cover ongoing jobs.
    console.error("[instrumentation] lead-finder worker boot failed:", err);
  }
}
