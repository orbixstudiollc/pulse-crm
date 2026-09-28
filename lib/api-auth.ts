import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isUuid, timingSafeEqualStr } from "@/lib/security";

/**
 * Public API authentication.
 *
 * Requires TWO headers for every public API call:
 *   - `x-api-key`: must match `process.env.PULSE_CRM_API_KEY`
 *     (compared in constant time)
 *   - `x-organization-id`: UUID of the org whose data is being read
 *
 * The API key proves the caller is trusted at all; the org header tells us
 * which tenant's data to scope to. Every public route MUST then filter queries
 * with `.eq("organization_id", orgId)` — this library only verifies the
 * credentials, it does NOT bypass RLS-style scoping.
 *
 * Design note: this is still a single shared secret. For stronger isolation,
 * upgrade to per-organization hashed API keys stored in a `public_api_keys`
 * table.
 */
export async function authenticatePublicRequest(
  request: NextRequest
): Promise<
  | { ok: true; orgId: string }
  | { ok: false; response: NextResponse }
> {
  const expected = process.env.PULSE_CRM_API_KEY;
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Public API is not configured" },
        { status: 503, headers: corsHeaders }
      ),
    };
  }

  const apiKey = request.headers.get("x-api-key") ?? "";
  if (!apiKey || !timingSafeEqualStr(apiKey, expected)) {
    return { ok: false, response: unauthorized() };
  }

  const orgId = request.headers.get("x-organization-id") ?? "";
  if (!isUuid(orgId)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Missing or invalid x-organization-id header (must be a valid UUID).",
        },
        { status: 400, headers: corsHeaders }
      ),
    };
  }

  // Ensure the org actually exists (prevents probing arbitrary UUIDs).
  const admin = createAdminClient();
  const { data: org, error } = await admin
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .maybeSingle();

  if (error || !org) {
    return { ok: false, response: unauthorized() };
  }

  return { ok: true, orgId };
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized — invalid credentials" },
    { status: 401, headers: corsHeaders }
  );
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "x-api-key, x-organization-id, Content-Type",
};

/**
 * @deprecated Use `authenticatePublicRequest` instead — it also resolves the
 * org id and enforces a constant-time compare.
 */
export function validateApiKey(request: NextRequest): boolean {
  const expected = process.env.PULSE_CRM_API_KEY;
  if (!expected) return false;
  const apiKey = request.headers.get("x-api-key") ?? "";
  return timingSafeEqualStr(apiKey, expected);
}
