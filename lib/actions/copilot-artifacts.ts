"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";
import type { CopilotArtifactKind } from "@/types/database";

// Artifacts are soft-deleted (deleted_at); every query is scoped by organization_id.

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const RECORD_LIMIT = 5;

type LinkedRecordType = "lead" | "deal" | "customer" | "contact" | "competitor";

const clampLimit = (limit: number) => Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);

/** Escape LIKE wildcards so user text is matched literally. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listArtifacts(
  opts: { q?: string; kind?: CopilotArtifactKind; starred?: boolean; limit?: number } = {},
) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  let query = supabase
    .from("copilot_artifacts")
    .select("*")
    .eq("organization_id", orgId)
    .is("deleted_at", null);
  if (opts.kind) query = query.eq("kind", opts.kind);
  if (opts.starred) query = query.eq("starred", true);
  const q = opts.q?.trim();
  if (q) query = query.ilike("title", likePattern(q));

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(clampLimit(opts.limit ?? DEFAULT_LIMIT));
  if (error) throw new Error(`listArtifacts failed: ${error.message}`);
  return data ?? [];
}

export async function getArtifact(id: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("copilot_artifacts")
    .select("*")
    .eq("id", id)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`getArtifact failed: ${error.message}`);
  return data;
}

export async function setArtifactStarred(id: string, starred: boolean): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("copilot_artifacts")
    .update({ starred, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Not found" };
  return { success: true };
}

/** Soft delete: sets deleted_at, never removes the row. */
export async function deleteArtifact(id: string): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("copilot_artifacts")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", id)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Not found" };
  return { success: true };
}

export async function restoreArtifact(id: string): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("copilot_artifacts")
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", orgId)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Not found" };
  return { success: true };
}

export async function listArtifactsForRecord(type: LinkedRecordType, id: string, limit: number = RECORD_LIMIT) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from("copilot_artifacts")
    .select("*")
    .eq("organization_id", orgId)
    .eq("linked_record_type", type)
    .eq("linked_record_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(clampLimit(limit));
  if (error) throw new Error(`listArtifactsForRecord failed: ${error.message}`);
  return data ?? [];
}
