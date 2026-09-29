import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { generateSeed, type SeedBundle } from "./generate";

// Writes a SeedBundle: one insert per table, parents first (with
// `.select("id")`) so child rows' `parentIndex` can be resolved to real ids,
// independent tables in parallel. Never throws; failures are collected in
// `errors` and children of a failed parent are skipped.

type Db = SupabaseClient<Database>;
type InsertResult = PromiseLike<{
  data: { id: string }[] | null;
  error: { message: string; code?: string } | null;
}>;

async function insertRows<R>(
  label: string,
  rows: R[],
  exec: (rows: R[]) => InsertResult,
  errors: string[],
  ignoreCode?: string,
): Promise<string[]> {
  if (rows.length === 0) return [];
  try {
    const { data, error } = await exec(rows);
    if (error) {
      if (!ignoreCode || error.code !== ignoreCode) errors.push(`${label}: ${error.message}`);
      return [];
    }
    return (data ?? []).map((row) => row.id);
  } catch (e) {
    errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

/** Replaces each row's parentIndex with the parent id; drops rows whose parent was not inserted. */
function resolve<C extends { parentIndex: number }, R>(
  rows: C[],
  parentIds: string[],
  build: (row: Omit<C, "parentIndex">, parentId: string) => R,
): R[] {
  return rows.flatMap(({ parentIndex, ...row }) => {
    const parentId = parentIds[parentIndex];
    return parentId ? [build(row, parentId)] : [];
  });
}

export async function insertSeed(
  client: Db,
  orgId: string,
  bundle: SeedBundle = generateSeed(orgId),
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  const b = bundle;

  const customerTree = async (): Promise<string[][]> => {
    const customerIds = await insertRows("Customers", b.customers, (r) => client.from("customers").insert(r).select("id"), errors);
    const dealTree = async () => {
      const dealIds = await insertRows("Deals", resolve(b.deals, customerIds, (row, id) => ({ ...row, customer_id: id })), (r) => client.from("deals").insert(r).select("id"), errors);
      const proposalIds = await insertRows("Proposals", resolve(b.proposals, dealIds, (row, id) => ({ ...row, deal_id: id })), (r) => client.from("proposals").insert(r).select("id"), errors);
      return [dealIds, proposalIds];
    };
    const [deals, contactIds, activityIds] = await Promise.all([
      dealTree(),
      insertRows("Contacts", resolve(b.contacts, customerIds, (row, id) => ({ ...row, customer_id: id })), (r) => client.from("contacts").insert(r).select("id"), errors),
      insertRows("Activities", resolve(b.activities, customerIds, (row, id) => ({ ...row, related_type: "customer" as const, related_id: id })), (r) => client.from("activities").insert(r).select("id"), errors),
    ]);
    return [customerIds, ...deals, contactIds, activityIds];
  };

  const competitorTree = async (): Promise<string[][]> => {
    const competitorIds = await insertRows("Competitors", b.competitors, (r) => client.from("competitors").insert(r).select("id"), errors);
    const battleCardIds = await insertRows("Battle Cards", resolve(b.battleCards, competitorIds, (row, id) => ({ ...row, competitor_id: id })), (r) => client.from("battle_cards").insert(r).select("id"), errors);
    return [competitorIds, battleCardIds];
  };

  const sequenceTree = async (): Promise<string[][]> => {
    const sequenceIds = await insertRows("Sequences", b.sequences, (r) => client.from("sequences").insert(r).select("id"), errors);
    const stepIds = await insertRows("Sequence Steps", resolve(b.sequenceSteps, sequenceIds, (row, id) => ({ ...row, sequence_id: id })), (r) => client.from("sequence_steps").insert(r).select("id"), errors);
    return [sequenceIds, stepIds];
  };

  const groups = await Promise.all([
    customerTree(),
    competitorTree(),
    sequenceTree(),
    Promise.all([
      insertRows("Leads", b.leads, (r) => client.from("leads").insert(r).select("id"), errors),
      insertRows("Objections", b.objections, (r) => client.from("objection_playbook").insert(r).select("id"), errors),
      insertRows("ICP Profiles", b.icpProfiles, (r) => client.from("icp_profiles").insert(r).select("id"), errors),
      // 23505: the org already has a default scoring profile.
      insertRows("Scoring Profile", [b.scoringProfile], (r) => client.from("scoring_profiles").insert(r).select("id"), errors, "23505"),
      insertRows("Email Templates", b.emailTemplates, (r) => client.from("email_templates").insert(r).select("id"), errors),
      insertRows("Copy Templates", b.copyTemplates, (r) => client.from("copy_templates").insert(r).select("id"), errors),
      insertRows("Calendar Events", b.calendarEvents, (r) => client.from("calendar_events").insert(r).select("id"), errors),
    ]),
  ]);

  const inserted = groups.flat().reduce((sum, ids) => sum + ids.length, 0);
  return { inserted, errors };
}
