import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { stageDays } from "@/lib/deals/metrics";
import { buildMemoryBlock, type MemoryBlockResult } from "./memory-block";
import type { ChatRequestContext } from "./chat-request";
import type { CopilotMemoryType, Database } from "@/types/database";

/**
 * Page context for the Copilot system prompt. The caller has already resolved
 * the user's org; every query here runs on the user's RLS client AND carries
 * an explicit organization_id predicate.
 */
export async function assembleContext(context: ChatRequestContext, orgId: string): Promise<string> {
  const supabase = await createClient();
  const parts: string[] = [];
  if (context.page) parts.push(`Current page: ${context.page}`);

  // Fetch entity-specific data
  if (context.entityType && context.entityId) {
    const entityData = await fetchEntityData(supabase, context.entityType, context.entityId, orgId);
    if (entityData) parts.push(entityData);
  }

  if (context.selectedIds?.length) {
    const kind = context.entityType ?? "record";
    parts.push(`Selected ${kind} ids (${context.selectedIds.length}): ${context.selectedIds.join(", ")}`);
  }

  // Always add org summary for context
  const orgSummary = await fetchOrgSummary(supabase, orgId);
  if (orgSummary) parts.push(orgSummary);

  return parts.join("\n\n---\n\n");
}

/**
 * The workspace-memory block for the system prompt: active memories and ICP
 * profiles of this org, capped at `capTokens` (lib/ai/memory-block.ts).
 * A failed read yields an empty block rather than failing the turn.
 */
export async function loadMemoryBlock(
  db: SupabaseClient<Database>,
  orgId: string,
  capTokens: number
): Promise<MemoryBlockResult> {
  const [memRes, icpRes] = await Promise.all([
    db
      .from("copilot_memory")
      .select("type, content, is_active, created_at")
      .eq("organization_id", orgId)
      .eq("is_active", true),
    db
      .from("icp_profiles")
      .select("name, description, criteria, buyer_personas, is_primary")
      .eq("organization_id", orgId),
  ]);
  if (memRes.error) console.error("[copilot] loading workspace memory failed:", memRes.error.message);
  if (icpRes.error) console.error("[copilot] loading ICP profiles failed:", icpRes.error.message);
  const memories = (memRes.data ?? []).map((m) => ({
    type: m.type as CopilotMemoryType,
    content: m.content,
    is_active: m.is_active !== false,
    created_at: m.created_at,
  }));
  return buildMemoryBlock({ memories, icpProfiles: icpRes.data ?? [], capTokens });
}

async function fetchEntityData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entityType: string,
  entityId: string,
  orgId: string
): Promise<string | null> {
  switch (entityType) {
    case "lead": {
      const { data: lead } = await supabase
        .from("leads")
        .select("*")
        .eq("id", entityId)
        .eq("organization_id", orgId)
        .single();

      if (!lead) return null;

      // Fetch related data
      const [notesRes, activitiesRes, scoresRes] = await Promise.all([
        supabase
          .from("lead_notes")
          .select("*")
          .eq("lead_id", entityId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("activities")
          .select("*")
          .eq("lead_id", entityId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("lead_score_history")
          .select("*")
          .eq("lead_id", entityId)
          .order("scored_at", { ascending: false })
          .limit(3),
      ]);

      return `**Lead: ${lead.name}**
Company: ${lead.company || "N/A"}
Email: ${lead.email || "N/A"}
Status: ${lead.status}
Source: ${lead.source || "N/A"}
Score: ${lead.score ?? "Unscored"}
Estimated Value: $${lead.estimated_value || 0}
Industry: ${lead.industry || "N/A"}
Employees: ${lead.employees || "N/A"}
Phone: ${lead.phone || "N/A"}
Website: ${lead.website || "N/A"}
LinkedIn: ${lead.linkedin || "N/A"}
Win Probability: ${lead.win_probability || 0}%
Qualification: ${lead.qualification_data ? JSON.stringify(lead.qualification_data) : "Not qualified"}

Recent Notes (${notesRes.data?.length || 0}):
${notesRes.data?.map((n) => `- ${n.content}`).join("\n") || "None"}

Recent Activities (${activitiesRes.data?.length || 0}):
${activitiesRes.data?.map((a) => `- [${a.type}] ${a.description || a.type} (${new Date(a.created_at).toLocaleDateString()})`).join("\n") || "None"}

Score History:
${scoresRes.data?.map((s) => `- Score: ${s.score} on ${new Date(s.scored_at).toLocaleDateString()}`).join("\n") || "None"}`;
    }

    case "deal": {
      const { data: deal } = await supabase
        .from("deals")
        .select("*")
        .eq("id", entityId)
        .eq("organization_id", orgId)
        .single();

      if (!deal) return null;

      // Fetch customer if linked
      let customerInfo = "N/A";
      if (deal.customer_id) {
        const { data: customer } = await supabase
          .from("customers")
          .select("first_name, last_name, company")
          .eq("id", deal.customer_id)
          .single();
        if (customer) customerInfo = `${customer.first_name} ${customer.last_name} (${customer.company || "N/A"})`;
      }

      return `**Deal: ${deal.name}**
Value: $${deal.value || 0}
Stage: ${deal.stage}
Close Date: ${deal.close_date || "N/A"}
Probability: ${deal.probability || 0}%
Days in Stage: ${stageDays(deal.stage_changed_at, deal.created_at)}
Customer: ${customerInfo}
Contact: ${deal.contact_name || "N/A"} (${deal.contact_email || "N/A"})
Notes: ${deal.notes || "None"}`;
    }

    case "customer": {
      const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("id", entityId)
        .eq("organization_id", orgId)
        .single();

      if (!customer) return null;

      const { data: deals } = await supabase
        .from("deals")
        .select("name, value, stage")
        .eq("customer_id", entityId)
        .eq("organization_id", orgId);

      return `**Customer: ${customer.first_name} ${customer.last_name}**
Email: ${customer.email || "N/A"}
Company: ${customer.company || "N/A"}
Phone: ${customer.phone || "N/A"}
Status: ${customer.status}
Plan: ${customer.plan || "N/A"}
MRR: $${customer.mrr || 0}
Health Score: ${customer.health_score || 0}
Total Deals: ${deals?.length || 0}
Total Value: $${deals?.reduce((sum, d) => sum + (d.value || 0), 0) || 0}
Deals: ${deals?.map((d) => `${d.name} ($${d.value}, ${d.stage})`).join("; ") || "None"}`;
    }

    case "competitor": {
      const { data: competitor } = await supabase
        .from("competitors")
        .select("*")
        .eq("id", entityId)
        .eq("organization_id", orgId)
        .single();

      if (!competitor) return null;

      const { data: battleCards } = await supabase
        .from("battle_cards")
        .select("*")
        .eq("competitor_id", entityId);

      return `**Competitor: ${competitor.name}**
Website: ${competitor.website || "N/A"}
Category: ${competitor.category || "N/A"}
Description: ${competitor.description || "N/A"}
Strengths: ${competitor.strengths?.join(", ") || "N/A"}
Weaknesses: ${competitor.weaknesses?.join(", ") || "N/A"}
Pricing: ${competitor.pricing ? JSON.stringify(competitor.pricing) : "N/A"}
Battle Cards: ${battleCards?.length || 0}`;
    }

    default:
      return null;
  }
}

async function fetchOrgSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
): Promise<string | null> {
  const [leadsRes, dealsRes, customersRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id, status", { count: "exact", head: true })
      .eq("organization_id", orgId),
    supabase
      .from("deals")
      .select("value, stage")
      .eq("organization_id", orgId),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
  ]);

  const totalLeads = leadsRes.count || 0;
  const totalCustomers = customersRes.count || 0;
  const deals = dealsRes.data || [];
  const totalPipelineValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
  const activeDeals = deals.filter((d) => !["closed_won", "closed_lost"].includes(d.stage)).length;

  return `**Organization Summary**
Total Leads: ${totalLeads}
Active Deals: ${activeDeals} (Pipeline: $${totalPipelineValue.toLocaleString()})
Total Customers: ${totalCustomers}`;
}
