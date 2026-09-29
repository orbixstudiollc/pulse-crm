// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  TRACKING_MAX_BODY_BYTES,
  clientIpFromHeaders,
  trackingEventSchema,
} from "@/lib/tracking/schema";
import {
  TRACKING_BUCKET,
  TRACKING_MAX_BUCKETS,
  takeToken,
  trackingBuckets,
  type Bucket,
} from "@/lib/tracking/rate-limit";

const valid = {
  script_key: "abc123",
  session_id: "s1",
  page_url: "https://example.com/pricing",
  page_title: "Pricing",
  referrer: "https://google.com/",
  duration: 1200,
  scroll_depth: 50,
};

function headers(h: Record<string, string>) {
  return (name: string) => h[name] ?? null;
}

describe("trackingEventSchema", () => {
  it("accepts a valid event", () => {
    expect(trackingEventSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a missing script_key", () => {
    const { script_key: _omit, ...rest } = valid;
    expect(trackingEventSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a non-URL page_url", () => {
    expect(trackingEventSchema.safeParse({ ...valid, page_url: "not a url" }).success).toBe(false);
  });

  it("rejects a 2100-char page_url", () => {
    const page_url = "https://example.com/" + "a".repeat(2100 - "https://example.com/".length);
    expect(page_url.length).toBe(2100);
    expect(trackingEventSchema.safeParse({ ...valid, page_url }).success).toBe(false);
  });

  it("rejects scroll_depth 150", () => {
    expect(trackingEventSchema.safeParse({ ...valid, scroll_depth: 150 }).success).toBe(false);
  });
});

describe("clientIpFromHeaders", () => {
  it("prefers x-real-ip", () => {
    expect(
      clientIpFromHeaders(headers({ "x-real-ip": "8.8.8.8", "x-forwarded-for": "1.1.1.1" }))
    ).toBe("8.8.8.8");
  });

  it("parses the first x-forwarded-for entry", () => {
    expect(clientIpFromHeaders(headers({ "x-forwarded-for": " 1.1.1.1 , 8.8.4.4" }))).toBe("1.1.1.1");
  });

  it.each(["garbage", "10.0.0.1", "127.0.0.1"])("returns null for %s", (ip) => {
    expect(clientIpFromHeaders(headers({ "x-real-ip": ip }))).toBeNull();
  });
});

describe("takeToken", () => {
  it("allows capacity calls then denies", () => {
    const store = new Map<string, Bucket>();
    for (let i = 0; i < TRACKING_BUCKET.capacity; i++) {
      expect(takeToken(store, "k", 0)).toBe(true);
    }
    expect(takeToken(store, "k", 0)).toBe(false);
  });

  it("refills after time passes", () => {
    const store = new Map<string, Bucket>();
    for (let i = 0; i < TRACKING_BUCKET.capacity; i++) takeToken(store, "k", 0);
    expect(takeToken(store, "k", 0)).toBe(false);
    expect(takeToken(store, "k", 2000)).toBe(true);
  });

  it("keeps the shared store bounded across many distinct keys", () => {
    for (let i = 0; i < 10_050; i++) takeToken(trackingBuckets, `key-${i}`, i);
    expect(trackingBuckets.size).toBeLessThanOrEqual(TRACKING_MAX_BUCKETS + 1);
    trackingBuckets.clear();
  });
});

describe("TRACKING_MAX_BODY_BYTES", () => {
  it("is 16384", () => {
    expect(TRACKING_MAX_BODY_BYTES).toBe(16384);
  });
});
