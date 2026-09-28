import { getOrgId } from "@/lib/actions/helpers";

export const POSTPEER_DISABLED_MESSAGE =
  "Social publishing is not enabled for this workspace";

/**
 * The PostPeer account is shared, so only the one configured organization may
 * use it. A missing or blank POSTPEER_OWNER_ORG_ID disables it for everyone.
 */
export function isPostPeerOwnerOrg(
  orgId: string,
  configured: string | undefined
): boolean {
  if (!configured || configured.trim() === "") return false;
  return configured === orgId;
}

export async function requirePostPeerOrg(): Promise<string> {
  const orgId = await getOrgId();
  if (!isPostPeerOwnerOrg(orgId, process.env.POSTPEER_OWNER_ORG_ID)) {
    throw new Error(POSTPEER_DISABLED_MESSAGE);
  }
  return orgId;
}
