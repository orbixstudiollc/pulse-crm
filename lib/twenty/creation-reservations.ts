import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";

export type CreationReservation = {
  ids: string[];
  orgId: string;
  userId: string;
  connectionId: string;
  approvalHash: string;
};

/** Permanent fences protect uncertain creates; there is deliberately no lease expiry/replay. */
export async function claimCreationReservations(args: {
  orgId: string; userId: string; connectionId: string; approvalHash: string; keys: string[];
}, db: SupabaseClient = createAdminClient()): Promise<CreationReservation> {
  const keys = [...new Set(args.keys)].sort();
  if (!keys.length || keys.length !== args.keys.length || keys.length > 2 || !/^[a-f0-9]{64}$/.test(args.approvalHash)) throw new Error("invalid_creation_reservation");
  const { data, error } = await db.rpc("twenty_claim_creation_reservations", {
    p_org: args.orgId, p_connection: args.connectionId, p_user: args.userId, p_hash: args.approvalHash, p_keys: keys,
  });
  if (error) throw new Error(error.message.includes("creation_key_busy") ? "creation_reserved_requires_review" : "creation_reservation_unconfirmed");
  if (!Array.isArray(data) || data.length !== keys.length || data.some((id) => typeof id !== "string")) throw new Error("creation_reservation_unconfirmed");
  return { ids: data as string[], orgId: args.orgId, userId: args.userId, connectionId: args.connectionId, approvalHash: args.approvalHash };
}

/** Known untouched keys can be released; completed or uncertain keys retain a durable fence. */
export async function finishCreationReservations(
  reservation: CreationReservation,
  state: "success" | "known_failure" | "unknown_outcome",
  externalIds: Record<string, string>,
  db: SupabaseClient = createAdminClient(),
): Promise<void> {
  const { error } = await db.rpc("twenty_finish_creation_reservations", {
    p_org: reservation.orgId, p_connection: reservation.connectionId, p_user: reservation.userId,
    p_hash: reservation.approvalHash, p_ids: reservation.ids, p_state: state, p_external_ids: externalIds,
  });
  if (error) throw Object.assign(new Error("creation_outcome_requires_reconciliation"), { code: "creation_outcome_requires_reconciliation", outcome: "unknown_outcome" });
}
