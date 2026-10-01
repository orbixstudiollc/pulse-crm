"use server";

// The Copilot start screen's "Today" counts. Every query is a head-only count scoped to the
// caller's workspace; a failed query leaves its field null so the screen still renders.

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";

export type AssistantBrief = {
  /** Open leads whose next_followup (a DATE) is today. */
  followupsDueToday: number | null;
  /** Open leads whose next_followup is before today. */
  overdueFollowups: number | null;
  /** Open hot leads not contacted (last_contacted_at) in HOT_UNTOUCHED_DAYS, or never. */
  hotLeadsUntouched: number | null;
  /** Open deals (not closed won or lost) not updated (updated_at) in STALE_DEAL_DAYS. */
  staleDeals: number | null;
  /** The caller's own pending task approvals: the ones the approvals view lets them answer. */
  pendingApprovals: number | null;
};

const HOT_UNTOUCHED_DAYS = 7;
const STALE_DEAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

type CountResponse = { count: number | null; error: { message: string } | null };

async function countOf(label: string, query: PromiseLike<CountResponse>): Promise<number | null> {
  try {
    const { count, error } = await query;
    if (error) {
      console.error(`Copilot brief: counting ${label} failed:`, error.message);
      return null;
    }
    return count ?? 0;
  } catch (error) {
    console.error(`Copilot brief: counting ${label} failed:`, error);
    return null;
  }
}

export async function getAssistantBrief(): Promise<AssistantBrief> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const now = Date.now();
  // next_followup is a DATE; "today" is the UTC day, as on the server.
  const today = new Date(now).toISOString().slice(0, 10);
  const hotCutoff = new Date(now - HOT_UNTOUCHED_DAYS * DAY_MS).toISOString();
  const staleCutoff = new Date(now - STALE_DEAL_DAYS * DAY_MS).toISOString();

  const count = (table: "leads" | "deals" | "copilot_approvals") =>
    supabase.from(table).select("id", { count: "exact", head: true }).eq("organization_id", orgId);
  const openLeads = () => count("leads").is("converted_at", null);

  const pendingApprovals = async (): Promise<number | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return countOf(
      "pending approvals",
      count("copilot_approvals").eq("user_id", user.id).eq("status", "pending").eq("source", "task"),
    );
  };

  const [followupsDueToday, overdueFollowups, hotLeadsUntouched, staleDeals, approvals] = await Promise.all([
    countOf("follow-ups due today", openLeads().eq("next_followup", today)),
    countOf("overdue follow-ups", openLeads().lt("next_followup", today)),
    countOf(
      "untouched hot leads",
      openLeads().eq("status", "hot").or(`last_contacted_at.is.null,last_contacted_at.lt."${hotCutoff}"`),
    ),
    countOf(
      "stale deals",
      count("deals").not("stage", "in", "(closed_won,closed_lost)").lt("updated_at", staleCutoff),
    ),
    pendingApprovals().catch((error: unknown) => {
      console.error("Copilot brief: counting pending approvals failed:", error);
      return null;
    }),
  ]);

  return { followupsDueToday, overdueFollowups, hotLeadsUntouched, staleDeals, pendingApprovals: approvals };
}
