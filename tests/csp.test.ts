// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  blockedOrigin,
  buildCsp,
  documentPath,
  parseCspReports,
} from "@/lib/security/csp";

const SUPABASE = "https://abcd1234.supabase.co";

function directives(policy: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of policy.split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) map.set(name, values);
  }
  return map;
}

describe("buildCsp", () => {
  const policy = buildCsp({ supabaseUrl: SUPABASE, reportUri: "/api/csp-report" });
  const d = directives(policy);

  it("is a single line with no newlines", () => {
    expect(policy).not.toMatch(/\n/);
  });

  it("emits each directive exactly once", () => {
    const names = policy.split(";").map((p) => p.trim().split(/\s+/)[0]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("locks the defaults down", () => {
    expect(d.get("default-src")).toEqual(["'self'"]);
    expect(d.get("object-src")).toEqual(["'none'"]);
    expect(d.get("base-uri")).toEqual(["'self'"]);
    expect(d.get("form-action")).toEqual(["'self'"]);
    expect(d.get("frame-ancestors")).toEqual(["'none'"]);
    expect(d.get("frame-src")).toEqual(["'self'"]);
  });

  it("allows inline scripts and styles that Next needs without nonces", () => {
    expect(d.get("script-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(d.get("style-src")).toEqual([
      "'self'",
      "'unsafe-inline'",
      "https://fonts.googleapis.com",
    ]);
  });

  it("allows fonts and images from the expected sources", () => {
    expect(d.get("font-src")).toEqual(["'self'", "https://fonts.gstatic.com", "data:"]);
    expect(d.get("img-src")).toEqual(["'self'", "data:", "blob:", "https:"]);
  });

  it("allows Supabase over https and wss, plus Vercel vitals", () => {
    expect(d.get("connect-src")).toEqual([
      "'self'",
      "https://abcd1234.supabase.co",
      "wss://abcd1234.supabase.co",
      "https://vitals.vercel-insights.com",
    ]);
  });

  it("uses only the origin of the Supabase URL", () => {
    const p = directives(
      buildCsp({ supabaseUrl: "https://abcd1234.supabase.co/rest/v1/", reportUri: "/r" })
    );
    expect(p.get("connect-src")).toContain("https://abcd1234.supabase.co");
    expect(p.get("connect-src")).toContain("wss://abcd1234.supabase.co");
  });

  it("maps a local http Supabase URL to ws", () => {
    const p = directives(buildCsp({ supabaseUrl: "http://127.0.0.1:54321", reportUri: "/r" }));
    expect(p.get("connect-src")).toEqual([
      "'self'",
      "http://127.0.0.1:54321",
      "ws://127.0.0.1:54321",
      "https://vitals.vercel-insights.com",
    ]);
  });

  it("omits Supabase sources when the URL is missing or invalid", () => {
    for (const supabaseUrl of ["", "not a url"]) {
      const p = directives(buildCsp({ supabaseUrl, reportUri: "/r" }));
      expect(p.get("connect-src")).toEqual(["'self'", "https://vitals.vercel-insights.com"]);
    }
  });

  it("ends with the report-uri", () => {
    expect(d.get("report-uri")).toEqual(["/api/csp-report"]);
    expect(policy.trim().endsWith("report-uri /api/csp-report")).toBe(true);
  });
});

describe("blockedOrigin", () => {
  it("reduces a URL to its origin, dropping path and query", () => {
    expect(blockedOrigin("https://evil.example.com/x.js?token=secret")).toBe(
      "https://evil.example.com"
    );
    expect(blockedOrigin("wss://rt.example.com/socket?apikey=1")).toBe("wss://rt.example.com");
  });

  it("keeps CSP keywords and reduces other schemes to the scheme", () => {
    expect(blockedOrigin("inline")).toBe("inline");
    expect(blockedOrigin("eval")).toBe("eval");
    expect(blockedOrigin("data")).toBe("data");
    expect(blockedOrigin("data:image/png;base64,AAAA")).toBe("data");
    expect(blockedOrigin("blob:https://app.example.com/uuid")).toBe("blob");
    expect(blockedOrigin("chrome-extension://abcdef/script.js")).toBe("chrome-extension");
  });

  it("returns a placeholder for empty or junk input", () => {
    expect(blockedOrigin("")).toBe("none");
    expect(blockedOrigin(undefined)).toBe("none");
    expect(blockedOrigin(42)).toBe("none");
    expect(blockedOrigin("a b\nc")).toBe("unknown");
  });
});

describe("documentPath", () => {
  it("keeps only the path", () => {
    expect(documentPath("https://app.example.com/dashboard/leads?id=1&t=secret#x")).toBe(
      "/dashboard/leads"
    );
  });

  it("returns unknown for non-URLs", () => {
    expect(documentPath("about:blank")).toBe("unknown");
    expect(documentPath("garbage")).toBe("unknown");
    expect(documentPath(undefined)).toBe("unknown");
  });

  it("truncates very long paths", () => {
    const long = "https://app.example.com/" + "a".repeat(500);
    expect(documentPath(long).length).toBeLessThanOrEqual(200);
  });
});

describe("parseCspReports", () => {
  it("reads the legacy application/csp-report shape", () => {
    const body = {
      "csp-report": {
        "document-uri": "https://app.example.com/dashboard?x=1",
        "violated-directive": "script-src-elem",
        "effective-directive": "script-src-elem",
        "blocked-uri": "https://cdn.evil.com/a.js?k=v",
      },
    };
    expect(parseCspReports(body, "csp-report")).toEqual([
      { directive: "script-src-elem", blocked: "https://cdn.evil.com", documentPath: "/dashboard" },
    ]);
  });

  it("falls back to the first token of violated-directive", () => {
    const body = {
      "csp-report": {
        "document-uri": "https://app.example.com/",
        "violated-directive": "img-src 'self' data:",
        "blocked-uri": "inline",
      },
    };
    expect(parseCspReports(body, "csp-report")[0].directive).toBe("img-src");
  });

  it("reads the Reporting API application/reports+json shape and skips other types", () => {
    const body = [
      {
        type: "csp-violation",
        url: "https://app.example.com/settings?tab=ai",
        body: {
          documentURL: "https://app.example.com/settings?tab=ai",
          effectiveDirective: "connect-src",
          blockedURL: "https://api.other.com/v1?key=abc",
        },
      },
      { type: "deprecation", url: "https://app.example.com/", body: {} },
    ];
    expect(parseCspReports(body, "reports+json")).toEqual([
      { directive: "connect-src", blocked: "https://api.other.com", documentPath: "/settings" },
    ]);
  });

  it("rejects directive names with unexpected characters", () => {
    const body = {
      "csp-report": {
        "document-uri": "https://app.example.com/",
        "effective-directive": "script-src\n[fake log line]",
        "blocked-uri": "eval",
      },
    };
    expect(parseCspReports(body, "csp-report")[0].directive).toBe("unknown");
  });

  it("returns an empty list for malformed bodies", () => {
    expect(parseCspReports(null, "csp-report")).toEqual([]);
    expect(parseCspReports({}, "csp-report")).toEqual([]);
    expect(parseCspReports({ "csp-report": "x" }, "csp-report")).toEqual([]);
    expect(parseCspReports({}, "reports+json")).toEqual([]);
    expect(parseCspReports([null, 1, "x"], "reports+json")).toEqual([]);
  });
});
