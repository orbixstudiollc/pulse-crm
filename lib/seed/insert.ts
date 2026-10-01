import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { generateSeed, type SeedBundle } from "./generate";

// Writes a SeedBundle: one write per table, parents first so child rows'
// `parentIndex` can be resolved to parent ids, independent tables in parallel.
// Every row gets its id here, so parent ids are known without reading them
// back and a write can be retried safely: rows go in with ON CONFLICT (id) DO
// NOTHING, so a retry after a lost response does not duplicate them. Transient
// network failures are retried; database errors are not. Never throws;
// failures are collected in `errors` and children of a failed parent are skipped.

type Db = SupabaseClient<Database>;
type WriteResult = PromiseLike<{ error: { message: string; code?: string } | null }>;

export interface InsertSeedOptions {
  /** Attempts per table write, including the first. */
  attempts?: number;
  /** Waits between attempts; injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_ATTEMPTS = 3;
const BACKOFF_MS = 300;
const UPSERT = { onConflict: "id", ignoreDuplicates: true } as const;
// A 5-character SQLSTATE (e.g. 23505, 42501) means the database answered: retrying won't help.
const SQLSTATE = /^[0-9A-Z]{5}$/;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function withId<R extends { id?: string }>(row: R): R & { id: string } {
  return { ...row, id: row.id ?? crypto.randomUUID() };
}

async function insertRows<R extends { id?: string }>(
  label: string,
  input: R[],
  exec: (rows: (R & { id: string })[]) => WriteResult,
  errors: string[],
  { attempts = DEFAULT_ATTEMPTS, sleep = wait }: InsertSeedOptions,
  ignoreCode?: string,
): Promise<string[]> {
  if (input.length === 0) return [];
  const rows = input.map(withId);
  const ids = rows.map((row) => row.id);

  for (let attempt = 1; ; attempt++) {
    let failure: string;
    try {
      const { error } = await exec(rows);
      if (!error) return ids;
      if (ignoreCode && error.code === ignoreCode) return ids;
      if (error.code && SQLSTATE.test(error.code)) {
        errors.push(`${label}: ${error.message}`);
        return [];
      }
      failure = error.message;
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
    }
    if (attempt >= attempts) {
      errors.push(`${label}: ${failure}`);
      return [];
    }
    await sleep(BACKOFF_MS * attempt);
  }
}

/** True unless a read confirms the org has no primary ICP, so a failed read never seeds a second primary. */
async function hasPrimaryIcp(client: Db, orgId: string): Promise<boolean> {
  try {
    const { data, error } = await client
      .from("icp_profiles")
      .select("id")
      .eq("organization_id", orgId)
      .eq("is_primary", true)
      .limit(1);
    return Boolean(error) || (data?.length ?? 0) > 0;
  } catch {
    return true;
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
  options: InsertSeedOptions = {},
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  const b = bundle;
  const o = options;

  const customerTree = async (): Promise<string[][]> => {
    const customerIds = await insertRows("Customers", b.customers, (r) => client.from("customers").upsert(r, UPSERT), errors, o);
    const dealTree = async () => {
      const dealIds = await insertRows("Deals", resolve(b.deals, customerIds, (row, id) => ({ ...row, customer_id: id })), (r) => client.from("deals").upsert(r, UPSERT), errors, o);
      const proposalIds = await insertRows("Proposals", resolve(b.proposals, dealIds, (row, id) => ({ ...row, deal_id: id })), (r) => client.from("proposals").upsert(r, UPSERT), errors, o);
      return [dealIds, proposalIds];
    };
    const [deals, contactIds, activityIds] = await Promise.all([
      dealTree(),
      insertRows("Contacts", resolve(b.contacts, customerIds, (row, id) => ({ ...row, customer_id: id })), (r) => client.from("contacts").upsert(r, UPSERT), errors, o),
      insertRows("Activities", resolve(b.activities, customerIds, (row, id) => ({ ...row, related_type: "customer" as const, related_id: id })), (r) => client.from("activities").upsert(r, UPSERT), errors, o),
    ]);
    return [customerIds, ...deals, contactIds, activityIds];
  };

  const competitorTree = async (): Promise<string[][]> => {
    const competitorIds = await insertRows("Competitors", b.competitors, (r) => client.from("competitors").upsert(r, UPSERT), errors, o);
    const battleCardIds = await insertRows("Battle Cards", resolve(b.battleCards, competitorIds, (row, id) => ({ ...row, competitor_id: id })), (r) => client.from("battle_cards").upsert(r, UPSERT), errors, o);
    return [competitorIds, battleCardIds];
  };

  const sequenceTree = async (): Promise<string[][]> => {
    const sequenceIds = await insertRows("Sequences", b.sequences, (r) => client.from("sequences").upsert(r, UPSERT), errors, o);
    const stepIds = await insertRows("Sequence Steps", resolve(b.sequenceSteps, sequenceIds, (row, id) => ({ ...row, sequence_id: id })), (r) => client.from("sequence_steps").upsert(r, UPSERT), errors, o);
    return [sequenceIds, stepIds];
  };

  // The seeded primary ICP only stays primary when the org has none yet.
  const icpTree = async (): Promise<string[]> => {
    const rows = (await hasPrimaryIcp(client, orgId))
      ? b.icpProfiles.map((p) => ({ ...p, is_primary: false }))
      : b.icpProfiles;
    return insertRows("ICP Profiles", rows, (r) => client.from("icp_profiles").upsert(r, UPSERT), errors, o);
  };

  const groups = await Promise.all([
    customerTree(),
    competitorTree(),
    sequenceTree(),
    Promise.all([
      insertRows("Leads", b.leads, (r) => client.from("leads").upsert(r, UPSERT), errors, o),
      insertRows("Objections", b.objections, (r) => client.from("objection_playbook").upsert(r, UPSERT), errors, o),
      icpTree(),
      // 23505: the org already has a default scoring profile.
      insertRows("Scoring Profile", [b.scoringProfile], (r) => client.from("scoring_profiles").upsert(r, UPSERT), errors, o, "23505"),
      insertRows("Email Templates", b.emailTemplates, (r) => client.from("email_templates").upsert(r, UPSERT), errors, o),
      insertRows("Copy Templates", b.copyTemplates, (r) => client.from("copy_templates").upsert(r, UPSERT), errors, o),
      insertRows("Calendar Events", b.calendarEvents, (r) => client.from("calendar_events").upsert(r, UPSERT), errors, o),
    ]),
  ]);

  const inserted = groups.flat().reduce((sum, ids) => sum + ids.length, 0);
  return { inserted, errors };
}
