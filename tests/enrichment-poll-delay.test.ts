// @vitest-environment node
import { describe, expect, it } from "vitest";
import { POLL_MAX_MS, POLL_MIN_MS, nextPollDelay } from "@/lib/lead-finder/poll-delay";

describe("nextPollDelay", () => {
  it("exposes the 2s floor and 60s ceiling", () => {
    expect(POLL_MIN_MS).toBe(2000);
    expect(POLL_MAX_MS).toBe(60000);
  });

  it("resets to the floor when the batch progressed", () => {
    expect(nextPollDelay(POLL_MIN_MS, true)).toBe(POLL_MIN_MS);
    expect(nextPollDelay(32000, true)).toBe(POLL_MIN_MS);
    expect(nextPollDelay(POLL_MAX_MS, true)).toBe(POLL_MIN_MS);
  });

  it("doubles the previous delay when nothing progressed", () => {
    expect(nextPollDelay(2000, false)).toBe(4000);
    expect(nextPollDelay(4000, false)).toBe(8000);
    expect(nextPollDelay(5000, false)).toBe(10000);
  });

  it("caps the delay at the ceiling", () => {
    expect(nextPollDelay(32000, false)).toBe(POLL_MAX_MS);
    expect(nextPollDelay(POLL_MAX_MS, false)).toBe(POLL_MAX_MS);
    expect(nextPollDelay(1_000_000, false)).toBe(POLL_MAX_MS);
  });

  it("treats a delay below the floor as the floor", () => {
    expect(nextPollDelay(0, false)).toBe(4000);
    expect(nextPollDelay(500, false)).toBe(4000);
    expect(nextPollDelay(-10, false)).toBe(4000);
    expect(nextPollDelay(0, true)).toBe(POLL_MIN_MS);
  });

  it("walks 2s -> 60s in five idle steps and stays there", () => {
    const seen: number[] = [];
    let delay = POLL_MIN_MS;
    for (let i = 0; i < 7; i++) {
      delay = nextPollDelay(delay, false);
      seen.push(delay);
    }
    expect(seen).toEqual([4000, 8000, 16000, 32000, 60000, 60000, 60000]);
  });
});
