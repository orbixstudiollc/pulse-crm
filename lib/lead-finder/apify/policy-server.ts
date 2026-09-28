import "server-only";

import { evaluateActorPolicy } from "./policy";
import { resolveApifyCredential, type ApifyCredential } from "./token";

/**
 * Resolve the Apify credential ONCE and check the actor policy against that
 * same snapshot. Callers must use the returned credential's token so the key
 * that runs the actor is the key that was authorized.
 */
export async function authorizeActors(
  orgId: string,
  actorIds: string[]
): Promise<ApifyCredential> {
  const cred = await resolveApifyCredential(orgId);
  if (!cred) {
    throw new Error(
      "Apify token not configured. Set it in Lead Finder Settings or as APIFY_API_TOKEN (APIFY_TOKEN / APIFY_API_KEY also accepted for back-compat)."
    );
  }
  const policy = evaluateActorPolicy(actorIds, cred.source);
  if (!policy.allowed) {
    throw new Error(
      `Custom Apify actors require your own Apify API key in Lead Finder Settings: ${policy.blocked.join(", ")}`
    );
  }
  return cred;
}
