export const POLL_MIN_MS = 2000;
export const POLL_MAX_MS = 60000;

/**
 * Delay before the next poll: back to the floor when the batch progressed,
 * otherwise double the previous delay (a delay below the floor counts as the
 * floor), capped at POLL_MAX_MS.
 */
export function nextPollDelay(prevDelay: number, progressed: boolean): number {
  if (progressed) return POLL_MIN_MS;
  return Math.min(Math.max(prevDelay, POLL_MIN_MS) * 2, POLL_MAX_MS);
}
