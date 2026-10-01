// Content-Security-Policy builder and CSP violation report parsing. Pure: no
// I/O, no env reads. next.config.ts ships the policy in Report-Only mode and
// app/api/csp-report/route.ts receives the reports.

export const CSP_REPORT_MAX_BYTES = 16_384;

const VERCEL_VITALS = "https://vitals.vercel-insights.com";
const MAX_PATH_LENGTH = 200;
const TOKEN = /^[a-z][a-z0-9-]*$/;

// Returns [https origin, ws(s) origin] for the Supabase project, or [] when
// the URL is missing or unparseable (a build without env vars must not crash).
function supabaseSources(supabaseUrl: string): string[] {
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return [];
    const ws = url.protocol === "https:" ? "wss:" : "ws:";
    return [url.origin, `${ws}//${url.host}`];
  } catch {
    return [];
  }
}

export function buildCsp({
  supabaseUrl,
  reportUri,
}: {
  supabaseUrl: string;
  reportUri: string;
}): string {
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    // 'unsafe-inline' because Next's inline bootstrap scripts need it unless
    // per-request nonces are wired through proxy/middleware. Next step: add a
    // nonce + 'strict-dynamic' and drop 'unsafe-inline' (see Next's CSP guide).
    ["script-src", ["'self'", "'unsafe-inline'"]],
    ["style-src", ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]],
    ["font-src", ["'self'", "https://fonts.gstatic.com", "data:"]],
    ["img-src", ["'self'", "data:", "blob:", "https:"]],
    ["connect-src", ["'self'", ...supabaseSources(supabaseUrl), VERCEL_VITALS]],
    ["frame-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ["report-uri", [reportUri]],
  ];
  return directives.map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
}

export type CspViolation = { directive: string; blocked: string; documentPath: string };

// Origin only for network URLs; the scheme for data:/blob:/extension URLs;
// CSP keywords ("inline", "eval") as-is. Never returns a path or query string.
export function blockedOrigin(value: unknown): string {
  if (typeof value !== "string" || value === "") return "none";
  if (TOKEN.test(value)) return value;
  try {
    const url = new URL(value);
    const scheme = url.protocol.slice(0, -1);
    if (["http", "https", "ws", "wss"].includes(scheme)) return url.origin;
    return TOKEN.test(scheme) ? scheme : "unknown";
  } catch {
    return "unknown";
  }
}

export function documentPath(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "unknown";
    return url.pathname.slice(0, MAX_PATH_LENGTH);
  } catch {
    return "unknown";
  }
}

function directiveName(effective: unknown, violated: unknown): string {
  const raw =
    typeof effective === "string" && effective
      ? effective
      : typeof violated === "string"
        ? violated.trim().split(/\s+/)[0]
        : "";
  return TOKEN.test(raw) ? raw : "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// kind "csp-report": legacy report-uri body { "csp-report": {...} }.
// kind "reports+json": Reporting API array of { type, url, body }.
export function parseCspReports(
  body: unknown,
  kind: "csp-report" | "reports+json"
): CspViolation[] {
  if (kind === "csp-report") {
    if (!isRecord(body) || !isRecord(body["csp-report"])) return [];
    const r = body["csp-report"];
    return [
      {
        directive: directiveName(r["effective-directive"], r["violated-directive"]),
        blocked: blockedOrigin(r["blocked-uri"]),
        documentPath: documentPath(r["document-uri"]),
      },
    ];
  }
  if (!Array.isArray(body)) return [];
  return body
    .filter((r): r is Record<string, unknown> => isRecord(r) && r.type === "csp-violation")
    .filter((r) => isRecord(r.body))
    .map((r) => {
      const b = r.body as Record<string, unknown>;
      return {
        directive: directiveName(b.effectiveDirective, b.violatedDirective),
        blocked: blockedOrigin(b.blockedURL),
        documentPath: documentPath(b.documentURL ?? r.url),
      };
    });
}
