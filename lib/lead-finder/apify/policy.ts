// =============================================================================
// Apify actor policy – pure, client-safe (no DB, no env)
//
// Built-in registry actors may run on any credential. Custom actors may only
// run on the tenant's own Apify key, never on the platform token.
// =============================================================================

import { ACTOR_REGISTRY } from "./registry";

// Mirrors ApifyCredentialSource in ./token (kept local so this module stays pure).
type CredentialSource = "tenant" | "platform";

const ACTOR_ID_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** Trim and convert Apify's URL form `owner~name` to `owner/name`. */
export function normalizeActorId(id: string): string {
  return id.trim().replace("~", "/");
}

export function isBuiltinActorId(id: string): boolean {
  const normalized = normalizeActorId(id);
  return ACTOR_REGISTRY.some((actor) => normalizeActorId(actor.id) === normalized);
}

export function evaluateActorPolicy(
  actorIds: string[],
  source: CredentialSource
): { allowed: boolean; blocked: string[] } {
  const blocked = actorIds.filter((id) => {
    const normalized = normalizeActorId(id);
    if (!ACTOR_ID_PATTERN.test(normalized)) return true;
    return source === "platform" && !isBuiltinActorId(normalized);
  });
  return { allowed: blocked.length === 0, blocked };
}
