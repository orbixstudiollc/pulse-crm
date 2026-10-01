// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { POST } from "@/app/api/csp-report/route";
import { CSP_REPORT_MAX_BYTES } from "@/lib/security/csp";

const URL_ = "https://app.example.com/api/csp-report";

function post(body: string, contentType: string | null, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extra };
  if (contentType) headers["content-type"] = contentType;
  return new Request(URL_, { method: "POST", headers, body });
}

const legacy = JSON.stringify({
  "csp-report": {
    "document-uri": "https://app.example.com/dashboard/leads?id=7&token=secret",
    "violated-directive": "script-src-elem",
    "effective-directive": "script-src-elem",
    "blocked-uri": "https://cdn.evil.com/x.js?k=secret",
  },
});

const reportingApi = JSON.stringify([
  {
    type: "csp-violation",
    url: "https://app.example.com/settings?tab=ai",
    body: {
      documentURL: "https://app.example.com/settings?tab=ai",
      effectiveDirective: "connect-src",
      blockedURL: "wss://rt.other.com/socket?apikey=secret",
    },
  },
]);

let warn: MockInstance<typeof console.warn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

describe("POST /api/csp-report", () => {
  it("accepts application/csp-report, logs one compact line and returns 204", async () => {
    const res = await POST(post(legacy, "application/csp-report"));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toBe(
      "[csp-report] directive=script-src-elem blocked=https://cdn.evil.com path=/dashboard/leads"
    );
  });

  it("accepts application/reports+json", async () => {
    const res = await POST(post(reportingApi, "application/reports+json"));
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toBe(
      "[csp-report] directive=connect-src blocked=wss://rt.other.com path=/settings"
    );
  });

  it("accepts a content type with parameters and mixed case", async () => {
    const res = await POST(post(legacy, "Application/CSP-Report; charset=utf-8"));
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("never logs query strings or full URLs", async () => {
    await POST(post(legacy, "application/csp-report"));
    await POST(post(reportingApi, "application/reports+json"));
    for (const call of warn.mock.calls) {
      const line = call.map(String).join(" ");
      expect(line).not.toContain("secret");
      expect(line).not.toContain("?");
      expect(line).not.toContain("x.js");
    }
  });

  it("rejects other content types with 415", async () => {
    const res = await POST(post(legacy, "application/json"));
    expect(res.status).toBe(415);
    expect(warn).not.toHaveBeenCalled();
  });

  it("rejects a missing content type with 415", async () => {
    const res = await POST(post(legacy, null));
    expect(res.status).toBe(415);
  });

  it("rejects a declared content-length over the cap with 413", async () => {
    const res = await POST(
      post(legacy, "application/csp-report", {
        "content-length": String(CSP_REPORT_MAX_BYTES + 1),
      })
    );
    expect(res.status).toBe(413);
    expect(warn).not.toHaveBeenCalled();
  });

  it("rejects an actual body over the cap with 413", async () => {
    const big = JSON.stringify({
      "csp-report": { "document-uri": "https://a.example.com/" + "a".repeat(CSP_REPORT_MAX_BYTES) },
    });
    const res = await POST(post(big, "application/csp-report"));
    expect(res.status).toBe(413);
    expect(warn).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await POST(post("{not json", "application/csp-report"));
    expect(res.status).toBe(400);
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns 204 and logs nothing for valid JSON with no CSP violations", async () => {
    const res = await POST(post(JSON.stringify([{ type: "deprecation" }]), "application/reports+json"));
    expect(res.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs at most 10 violations per request", async () => {
    const batch = JSON.stringify(Array.from({ length: 15 }, () => JSON.parse(reportingApi)[0]));
    const res = await POST(post(batch, "application/reports+json"));
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(10);
  });

  it("needs no cookies or auth", async () => {
    const res = await POST(post(legacy, "application/csp-report"));
    expect(res.status).toBe(204);
  });
});
