"use server";

// Copilot settings: the provider in use (never its key), the workspace's
// always-allow policy, today's shared-key usage, and clearing the caller's
// chat history.

import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, getOrgId, requireRole } from "./helpers";
import { customModelSettingsFor, resolveAIProvider } from "@/lib/ai/provider-resolver";
import { customModelFor } from "@/lib/ai/custom-provider";
import { getModelId } from "@/lib/ai/models";
import { getBudgetUsage } from "@/lib/ai/shared-budget";
import { COPILOT_WRITE_TOOLS, NEVER_AUTO_ALLOW, sanitizeAlwaysAllow } from "@/lib/ai/tools/policy";
import { deleteOwnConversations } from "@/lib/ai/conversation-delete";

export type CopilotSettings = {
  provider: {
    source: "org" | "env" | "none";
    provider: string | null;
    model: string | null;
    supportsTools: boolean;
  };
  alwaysAllow: string[];
  allowableTools: Array<{ name: string; label: string }>;
  usage: {
    orgUsedTokens: number;
    /** null when the workspace uses its own key: the shared limit does not apply. */
    orgLimitTokens: number | null;
    sharedUsedTokens: number;
    sharedLimitTokens: number;
    isGuest: boolean;
  };
};

// The columns resolveAIProvider reads, plus the always-allow list. The key
// columns are needed to resolve the provider; nothing from them is returned.
const SETTINGS_COLUMNS =
  "organization_id, ai_provider, api_key, openrouter_api_key, openrouter_oauth_token, openrouter_expires_at, openai_api_key, groq_api_key, ollama_base_url, custom_base_url, custom_api_key, custom_model, custom_fast_model, copilot_always_allow";

/** Providers the chat route runs with CRM tools (the others get one plain completion). */
const TOOL_PROVIDERS = ["anthropic", "openrouter", "custom"];

const CLEAR_CONFIRM_TEXT = "CLEAR";

/** "convert_lead_to_customer" -> "Convert lead to customer". */
function toolLabel(name: string): string {
  const words = name.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The chat model the route would use for this provider (mirrors app/api/ai/chat/route.ts). */
function chatModelFor(
  resolved: NonNullable<ReturnType<typeof resolveAIProvider>>,
  settings: { custom_model?: string | null; custom_fast_model?: string | null } | null
): string | null {
  if (resolved.provider === "custom") {
    return customModelFor("sonnet", customModelSettingsFor(resolved, settings) ?? {});
  }
  return getModelId("sonnet", resolved.provider);
}

export async function getCopilotSettings(): Promise<CopilotSettings> {
  const { user } = await getCurrentUserProfile();
  const orgId = await getOrgId();
  const isGuest = user.is_anonymous === true;

  // Secret columns are only readable with the service role; only derived, non-secret fields leave here.
  const { data: settings, error } = await createAdminClient()
    .from("ai_settings")
    .select(SETTINGS_COLUMNS)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) {
    console.error("[copilot-settings] reading AI settings failed:", error.message);
    throw new Error("Could not load Copilot settings");
  }

  const resolved = resolveAIProvider(settings ?? {}, process.env);
  const provider: CopilotSettings["provider"] = resolved
    ? {
        source: resolved.source,
        provider: resolved.provider,
        model: chatModelFor(resolved, settings),
        supportsTools: TOOL_PROVIDERS.includes(resolved.provider),
      }
    : { source: "none", provider: null, model: null, supportsTools: false };

  const budget = await getBudgetUsage(orgId, { isGuest });

  return {
    provider,
    alwaysAllow: sanitizeAlwaysAllow(settings?.copilot_always_allow),
    allowableTools: COPILOT_WRITE_TOOLS.filter((name) => !NEVER_AUTO_ALLOW.includes(name)).map((name) => ({
      name,
      label: toolLabel(name),
    })),
    usage: {
      orgUsedTokens: budget.orgUsedTokens,
      orgLimitTokens: provider.source === "env" ? budget.orgLimitTokens : null,
      sharedUsedTokens: budget.sharedUsedTokens,
      sharedLimitTokens: budget.sharedLimitTokens,
      isGuest,
    },
  };
}

/** Admin/owner only. Stores only allowlisted, auto-allowable write tools; returns what was stored. */
export async function setAlwaysAllow(tools: unknown): Promise<string[]> {
  const { orgId } = await requireRole("admin", "owner");
  const alwaysAllow = sanitizeAlwaysAllow(tools);

  const { data, error } = await createAdminClient()
    .from("ai_settings")
    .update({ copilot_always_allow: alwaysAllow })
    .eq("organization_id", orgId)
    .select("organization_id");
  if (error) {
    console.error("[copilot-settings] saving always-allow failed:", error.message);
    throw new Error("Could not save the always-allow setting");
  }
  if (!data?.length) throw new Error("AI settings not found for this workspace");
  return alwaysAllow;
}

/**
 * Deletes the caller's own Copilot conversations; messages and pending,
 * denied or expired chat approvals cascade with them. Approvals the user
 * granted and task-sourced approvals are detached first so they survive.
 * Artifacts (conversation_id SET NULL), memory and tasks are not touched.
 * Refuses while any of the caller's conversations is mid-turn.
 */
export async function clearChatHistory(
  confirmText: string
): Promise<{ deleted: number } | { error: "turn_in_progress" }> {
  if (confirmText !== CLEAR_CONFIRM_TEXT) {
    throw new Error(`Type ${CLEAR_CONFIRM_TEXT} to confirm`);
  }
  const { user } = await getCurrentUserProfile();
  const orgId = await getOrgId();
  // Service role (as lib/ai/history.ts): every query is scoped to this org and user explicitly.
  try {
    return await deleteOwnConversations(createAdminClient(), { orgId, userId: user.id });
  } catch (e) {
    console.error("[copilot-settings] clearing chat history failed:", e instanceof Error ? e.message : e);
    throw new Error("Could not clear chat history");
  }
}
