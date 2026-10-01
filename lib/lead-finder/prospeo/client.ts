import "server-only";

import { createAdminClient } from "@/lib/supabase/server";

// =============================================================================
// Prospeo API client – B2B people search and email/mobile enrichment.
// Docs: https://prospeo.io/api-docs
// =============================================================================

const PROSPEO_BASE_URL = "https://api.prospeo.io";
const REQUEST_TIMEOUT_MS = 30_000;

/** Prospeo error codes we branch on. Anything else is reported as-is. */
export type ProspeoErrorCode =
  | "NO_MATCH"
  | "NO_RESULTS"
  | "INVALID_DATAPOINTS"
  | "INVALID_FILTERS"
  | "INSUFFICIENT_CREDITS"
  | "INVALID_API_KEY"
  | "PLAN_REQUIRED"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED"
  | (string & {});

export class ProspeoError extends Error {
  constructor(
    message: string,
    public readonly code: ProspeoErrorCode,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ProspeoError";
  }

  /** "Nothing found" outcomes: not failures, and Prospeo does not charge for them. */
  get isEmpty(): boolean {
    return this.code === "NO_MATCH" || this.code === "NO_RESULTS";
  }

  /** Worth retrying later (rate limit or a temporary Prospeo-side problem). */
  get isRetryable(): boolean {
    return (
      this.code === "RATE_LIMITED" ||
      this.code === "SERVICE_TEMPORARILY_UNAVAILABLE" ||
      this.code === "INTERNAL_ERROR"
    );
  }
}

// ---------------------------------------------------------------------------
// API key: the workspace key in ai_settings wins over the platform env key.
// ---------------------------------------------------------------------------

export function getProspeoKeyFromEnv(): string | undefined {
  return process.env.PROSPEO_API_KEY || undefined;
}

export async function loadTenantProspeoKey(orgId: string): Promise<string | null> {
  // Admin client: cron/worker contexts have no cookie session; scoped by organization_id.
  const { data } = await createAdminClient()
    .from("ai_settings")
    .select("prospeo_api_key")
    .eq("organization_id", orgId)
    .limit(1)
    .maybeSingle();
  return ((data as { prospeo_api_key?: string | null } | null)?.prospeo_api_key) ?? null;
}

export async function tryGetProspeoKey(orgId?: string): Promise<string | undefined> {
  if (orgId) {
    const tenantKey = await loadTenantProspeoKey(orgId);
    if (tenantKey) return tenantKey;
  }
  return getProspeoKeyFromEnv();
}

export async function getProspeoKey(orgId?: string): Promise<string> {
  const key = await tryGetProspeoKey(orgId);
  if (!key) {
    throw new ProspeoError(
      "Prospeo API key not configured. Add it in Lead Finder Settings or set PROSPEO_API_KEY.",
      "NOT_CONFIGURED"
    );
  }
  return key;
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export async function prospeoRequest<T>(
  path: "/search-person" | "/enrich-person",
  body: Record<string, unknown>,
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<T> {
  let res: Response;
  try {
    res = await fetchImpl(`${PROSPEO_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-KEY": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new ProspeoError(
      `Prospeo unreachable: ${err instanceof Error ? err.message : String(err)}`,
      "SERVICE_TEMPORARILY_UNAVAILABLE"
    );
  }

  if (res.status === 429) {
    throw new ProspeoError("Prospeo rate limit exceeded", "RATE_LIMITED", 429);
  }

  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new ProspeoError(`Prospeo returned a non-JSON response (${res.status})`, "INTERNAL_ERROR", res.status);
  }

  if (!res.ok || json.error === true) {
    const code = typeof json.error_code === "string" ? json.error_code : `HTTP_${res.status}`;
    throw new ProspeoError(PROSPEO_ERROR_MESSAGES[code] ?? `Prospeo error ${code}`, code, res.status);
  }

  return json as T;
}

const PROSPEO_ERROR_MESSAGES: Record<string, string> = {
  NO_MATCH: "Prospeo found no match",
  NO_RESULTS: "Prospeo found no people for these filters",
  INVALID_DATAPOINTS: "Not enough data to look this person up (needs a name and company, or a LinkedIn URL)",
  INVALID_FILTERS: "Prospeo rejected the search filters",
  INSUFFICIENT_CREDITS: "Your Prospeo account is out of credits",
  INVALID_API_KEY: "The Prospeo API key is invalid",
  PLAN_REQUIRED: "This Prospeo filter needs a higher Prospeo plan",
};
