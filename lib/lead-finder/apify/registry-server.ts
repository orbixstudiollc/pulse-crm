import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import {
  ACTOR_REGISTRY,
  type ActorDefinition,
  type ActorCategory,
  type ActorPhase,
  type InputFieldDescription,
} from "./registry";

/**
 * Explicit database access for session-less callers (cron worker): the given
 * client is queried with `organization_id = orgId`. Omitted, the cookie-scoped
 * user client is used (UI callers).
 */
export type ActorDbScope = { db: SupabaseClient<Database>; orgId: string };

// =============================================================================
// Load custom (user-defined) actors from Supabase
// =============================================================================

async function getCustomActorsFromDb(
  orgId: string,
  scope?: ActorDbScope
): Promise<ActorDefinition[]> {
  try {
    const supabase = scope?.db ?? (await createClient());
    const { data } = await supabase
      .from("lf_custom_actors")
      .select("*")
      .eq("organization_id", scope?.orgId ?? orgId)
      .eq("is_enabled", true);

    return (data ?? []).map((r) => ({
      id: r.actor_id,
      name: r.name,
      category: (r.phase === "find"
        ? "lead-generation"
        : "enrichment") as ActorCategory,
      phase: r.phase as ActorPhase,
      description: r.description || "",
      requiredInputFields: (r.required_input_fields as unknown as string[]) || [],
      inputFieldDescriptions:
        (r.input_field_descriptions as unknown as Record<
          string,
          InputFieldDescription
        >) || undefined,
      defaultInput:
        (r.default_input as unknown as Record<string, unknown>) || {},
      isCustom: true,
      pageLimitKey: r.page_limit_key || undefined,
    }));
  } catch {
    return [];
  }
}

// =============================================================================
// Public API (server-only, org-scoped)
// =============================================================================

/** Get ALL actors: built-in + org-specific custom actors. */
export async function getAllActors(
  orgId: string,
  scope?: ActorDbScope
): Promise<ActorDefinition[]> {
  const custom = await getCustomActorsFromDb(orgId, scope);
  return [...ACTOR_REGISTRY, ...custom];
}

/** Lookup a single actor by ID (checks built-in first, then custom). */
export async function getActorById(
  id: string,
  orgId?: string,
  scope?: ActorDbScope
): Promise<ActorDefinition | undefined> {
  const builtin = ACTOR_REGISTRY.find((a) => a.id === id);
  if (builtin) return builtin;
  const effectiveOrgId = scope?.orgId ?? orgId;
  if (!effectiveOrgId) return undefined;
  const custom = await getCustomActorsFromDb(effectiveOrgId, scope);
  return custom.find((a) => a.id === id);
}

/** Get actors filtered by phase (find / enrich). */
export async function getActorsByPhase(
  phase: ActorPhase,
  orgId: string,
  scope?: ActorDbScope
): Promise<ActorDefinition[]> {
  const all = await getAllActors(orgId, scope);
  return all.filter((a) => a.phase === phase);
}

/** Get actors filtered by category. */
export async function getActorsByCategory(
  category: ActorCategory,
  orgId: string
): Promise<ActorDefinition[]> {
  const all = await getAllActors(orgId);
  return all.filter((a) => a.category === category);
}
