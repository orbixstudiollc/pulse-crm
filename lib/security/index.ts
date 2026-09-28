/**
 * Shared security helpers — CSRF, SSRF, cron auth, redirect validation,
 * timing-safe string comparison, UUID validation.
 */

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { BlockList, isIP } from "node:net";

// ── Timing-safe string compare ────────────────────────────────────────────

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // Normalize lengths to avoid length-based leaks
  if (bufA.length !== bufB.length) {
    // Still perform a compare of equal-length buffers to keep time ~constant
    const maxLen = Math.max(bufA.length, bufB.length);
    const padA = Buffer.alloc(maxLen);
    const padB = Buffer.alloc(maxLen);
    bufA.copy(padA);
    bufB.copy(padB);
    timingSafeEqual(padA, padB);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// ── UUID validation ───────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// ── Cron auth ─────────────────────────────────────────────────────────────

/**
 * Verifies an incoming cron request carries a valid `Authorization: Bearer <CRON_SECRET>`.
 * Returns `null` if OK, or a `NextResponse` with the appropriate status if not.
 *
 * Fails closed if `CRON_SECRET` is not set.
 */
export function verifyCronRequest(
  req: Request | NextRequest
): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Cron not configured" },
      { status: 503 }
    );
  }
  const authHeader = req.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!authHeader.startsWith(prefix)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.slice(prefix.length).trim();
  if (!token || !timingSafeEqualStr(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// ── Webhook shared-secret auth ────────────────────────────────────────────

export function verifyWebhookHeader(
  req: Request | NextRequest,
  headerName: string,
  envVar: string
): NextResponse | null {
  const expected = process.env[envVar];
  if (!expected) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }
  const received = req.headers.get(headerName) ?? "";
  if (!received || !timingSafeEqualStr(received, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// ── Redirect validation ───────────────────────────────────────────────────

/**
 * Ensures a `next` query-param is a safe internal path.
 * Rejects absolute URLs, protocol-relative URLs, and backslash tricks.
 */
export function isSafeInternalPath(path: string | null | undefined): boolean {
  if (!path || typeof path !== "string") return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.startsWith("/\\")) return false;
  if (path.includes("\\")) return false;
  // Reject trivial embedded schemes like `/javascript:foo`
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(path)) return false;
  return true;
}

/**
 * Returns true only if the URL is an absolute http(s) URL to an external
 * destination with no private/loopback/link-local host.
 */
export function isSafeExternalUrl(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  return !isPrivateHostname(parsed.hostname);
}

// ── SSRF guards ───────────────────────────────────────────────────────────

// One BlockList per family: Node's BlockList checks IPv4 addresses against
// IPv6 rules via their mapped form, so a shared list containing
// ::ffff:0:0/96 would match every IPv4 address.
const PRIVATE_BLOCKLIST = { ipv4: new BlockList(), ipv6: new BlockList() };
for (const [net4, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) {
  PRIVATE_BLOCKLIST.ipv4.addSubnet(net4, prefix, "ipv4");
}
for (const [net6, prefix] of [
  ["::", 128],
  ["::1", 128],
  // All IPv4-mapped literals (dotted or hex) are rejected outright.
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
] as const) {
  PRIVATE_BLOCKLIST.ipv6.addSubnet(net6, prefix, "ipv6");
}

export function isPrivateHostname(hostname: string): boolean {
  let host = hostname.toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  const zone = host.indexOf("%");
  if (zone !== -1) host = host.slice(0, zone);
  if (host.endsWith(".")) host = host.slice(0, -1);

  if (
    host === "localhost" ||
    host === "ip6-localhost" ||
    host === "ip6-loopback" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return true;
  }

  const family = isIP(host);
  if (family) {
    const type = family === 4 ? "ipv4" : "ipv6";
    return PRIVATE_BLOCKLIST[type].check(host, type);
  }

  return false;
}

/**
 * Validate a user-supplied URL before fetching server-side.
 * Returns a parsed URL or throws.
 */
export function assertSafeFetchUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }
  if (isPrivateHostname(url.hostname)) {
    throw new Error("Private or loopback hosts are not allowed");
  }
  return url;
}

// ── CSRF / Origin ─────────────────────────────────────────────────────────

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * For cookie-authenticated JSON APIs, require that mutating requests come from
 * the same origin as the server. Returns null if OK, or a 403 response.
 */
export function verifyOriginCsrf(req: NextRequest): NextResponse | null {
  const method = req.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return null;

  const requestOrigin = req.headers.get("origin");
  const selfOrigin = req.nextUrl.origin;
  if (!requestOrigin || requestOrigin !== selfOrigin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  return null;
}

// ── PostgREST filter escaping ─────────────────────────────────────────────

/**
 * Escape a free-text search term for safe use inside a PostgREST filter
 * string such as `.or("name.ilike.%TERM%,email.ilike.%TERM%")`.
 *
 * PostgREST uses `,` and `)` as separators inside filter expressions and
 * treats `*` / `%` / `_` as wildcards for `ilike`. We:
 *  - Strip characters that would let an attacker break out of a filter
 *    component or chain additional filters (`,`, `(`, `)`, `*`).
 *  - Escape `%` and `_` so they are treated as literals inside `ilike`.
 *
 * This is not a full sanitizer for raw SQL — it is specifically for values
 * placed into PostgREST filter-string DSL. All tenant filtering must still
 * happen via `.eq("organization_id", orgId)` etc.
 */
export function escapePostgrestLike(term: string): string {
  return String(term)
    .replace(/[\\]/g, "\\\\")
    .replace(/[%_]/g, (ch) => `\\${ch}`)
    .replace(/[,()*]/g, "");
}

// ── Sort-column allowlist ─────────────────────────────────────────────────

export function pickSortColumn<const T extends readonly string[]>(
  raw: string | null | undefined,
  allowed: T,
  fallback: T[number]
): T[number] {
  return (allowed as readonly string[]).includes(raw ?? "")
    ? (raw as T[number])
    : fallback;
}
