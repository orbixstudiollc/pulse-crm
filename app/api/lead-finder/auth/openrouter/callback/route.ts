/**
 * OpenRouter OAuth2 with PKCE — callback.
 *
 * GET /api/lead-finder/auth/openrouter/callback
 *
 * Exchanges the OpenRouter authorization code (plus the previously generated
 * code_verifier stored on the org's ai_settings row) for a scoped API key.
 * Uses a timing-safe comparison on the `state` cookie to mitigate CSRF.
 */

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/actions/helpers";
import { timingSafeEqualStr } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "orr_oauth_state";

/**
 * SECURITY: clear the stored code_verifier on every OAuth failure path so a
 * leaked or stale verifier cannot be replayed in a future run. We best-effort
 * update `ai_settings`; errors here are logged but don't change the redirect.
 */
async function clearVerifier(
  supabase: SupabaseClient,
  orgId: string
): Promise<void> {
  try {
    await supabase
      .from("ai_settings")
      .update({ openrouter_code_verifier: null })
      .eq("organization_id", orgId);
  } catch (err) {
    console.error("[openrouter-auth] failed to clear verifier", err);
  }
}

function redirectToSettings(
  origin: string,
  params: Record<string, string>
): NextResponse {
  const url = new URL("/dashboard/lead-finder/settings", origin);
  url.searchParams.set("tab", "ai");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url);
}

function clearStateAnd(res: NextResponse): NextResponse {
  res.cookies.delete(STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return clearStateAnd(redirectToSettings(origin, { error: "unauthorized" }));
  }

  let orgId: string;
  try {
    orgId = await getOrgId();
  } catch {
    return clearStateAnd(
      redirectToSettings(origin, { error: "no_organization" })
    );
  }

  const code = req.nextUrl.searchParams.get("code");
  const providedState = req.nextUrl.searchParams.get("state") ?? "";
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) {
    await clearVerifier(supabase, orgId);
    return clearStateAnd(redirectToSettings(origin, { error: oauthError }));
  }
  if (!code) {
    await clearVerifier(supabase, orgId);
    return clearStateAnd(redirectToSettings(origin, { error: "no_code" }));
  }

  const expectedState = req.cookies.get(STATE_COOKIE)?.value ?? "";
  if (
    !providedState ||
    !expectedState ||
    !timingSafeEqualStr(providedState, expectedState)
  ) {
    await clearVerifier(supabase, orgId);
    return clearStateAnd(
      redirectToSettings(origin, { error: "invalid_state" })
    );
  }

  // Retrieve the code_verifier previously persisted by the initiator.
  const { data: settingsRow, error: settingsErr } = await supabase
    .from("ai_settings")
    .select("openrouter_code_verifier")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (settingsErr || !settingsRow?.openrouter_code_verifier) {
    return clearStateAnd(
      redirectToSettings(origin, { error: "missing_verifier" })
    );
  }

  const codeVerifier = settingsRow.openrouter_code_verifier as string;

  let apiKey: string | null = null;
  let expiresAt: string | null = null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        code_challenge_method: "S256",
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        "[openrouter-auth] exchange failed",
        res.status,
        body.slice(0, 200)
      );
      await clearVerifier(supabase, orgId);
      return clearStateAnd(
        redirectToSettings(origin, { error: "exchange_failed" })
      );
    }

    const data = (await res.json()) as {
      key?: string;
      expires_at?: string;
      expiresAt?: string;
    };
    apiKey = data.key ?? null;
    expiresAt = data.expires_at ?? data.expiresAt ?? null;
  } catch (err) {
    console.error("[openrouter-auth] exchange threw", err);
    await clearVerifier(supabase, orgId);
    return clearStateAnd(redirectToSettings(origin, { error: "network" }));
  }

  if (!apiKey) {
    await clearVerifier(supabase, orgId);
    return clearStateAnd(redirectToSettings(origin, { error: "no_key" }));
  }

  const { error: saveErr } = await supabase
    .from("ai_settings")
    .update({
      openrouter_oauth_token: apiKey,
      openrouter_expires_at: expiresAt,
      openrouter_code_verifier: null,
      ai_provider: "openrouter",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", orgId);

  if (saveErr) {
    console.error("[openrouter-auth] save key failed", saveErr);
    return clearStateAnd(redirectToSettings(origin, { error: "save_failed" }));
  }

  return clearStateAnd(redirectToSettings(origin, { success: "true" }));
}
