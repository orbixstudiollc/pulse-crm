import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  ACTOR_REGISTRY,
  type ActorDefinition,
  type ActorCategory,
  type ActorPhase,
  type InputFieldDescription,
} from "./registry";

// =============================================================================
// Load custom (user-defined) actors from Supabase
// =============================================================================

async function getCustomActorsFromDb(
  orgId: string
): Promise<ActorDefinition[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("lf_custom_actors")
      .select("*")
      .eq("organization_id", orgId)
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
  orgId: string
): Promise<ActorDefinition[]> {
  const custom = await getCustomActorsFromDb(orgId);
  return [...ACTOR_REGISTRY, ...custom];
}

/** Lookup a single actor by ID (checks built-in first, then custom). */
export async function getActorById(
  id: string,
  orgId?: string
): Promise<ActorDefinition | undefined> {
  const builtin = ACTOR_REGISTRY.find((a) => a.id === id);
  if (builtin) return builtin;
  if (!orgId) return undefined;
  const custom = await getCustomActorsFromDb(orgId);
  return custom.find((a) => a.id === id);
}

/** Get actors filtered by phase (find / enrich). */
export async function getActorsByPhase(
  phase: ActorPhase,
  orgId: string
): Promise<ActorDefinition[]> {
  const all = await getAllActors(orgId);
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
