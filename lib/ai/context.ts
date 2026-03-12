import { createClient } from "@/lib/supabase/server";
import { PageContext } from "./types";

export async function assembleContext(pageContext: PageContext): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "User not authenticated.";

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) return "No organization context.";

  const orgId = profile.organization_id;
  const parts: string[] = [`Current page: ${pageContext.page}`];

  // Fetch entity-specific data
  if (pageContext.entityType && pageContext.entityId) {
    const entityData = await fetchEntityData(
      supabase,
      pageContext.entityType,
      pageContext.entityId,
      orgId
    );
    if (entityData) parts.push(entityData);
  }

  // Always add org summary for context
  const orgSummary = await fetchOrgSummary(supabase, orgId);
  if (orgSummary) parts.push(orgSummary);

  return parts.join("\n\n---\n\n");
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
Days in Stage: ${deal.days_in_stage || 0}
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

export async function fetchEntityForChat(
  entityType: string,
  entityId?: string,
  query?: string
): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated.";

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) return "No organization.";

  const orgId = profile.organization_id;

  switch (entityType) {
    case "lead": {
      if (entityId) {
        return (await fetchEntityData(supabase, "lead", entityId, orgId)) || "Lead not found.";
      }
      // Search leads
      if (query) {
        const { data } = await supabase
          .from("leads")
          .select("id, name, company, email, status, score, estimated_value")
          .eq("organization_id", orgId)
          .or(`name.ilike.%${query}%,company.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(10);
        return data?.length
          ? `Found ${data.length} leads:\n${data.map((l) => `- ${l.name} (${l.company || "N/A"}) - ${l.status}, Score: ${l.score ?? "N/A"}`).join("\n")}`
          : "No leads found matching query.";
      }
      return "Please provide a lead ID or search query.";
    }

    case "deal": {
      if (entityId) {
        return (await fetchEntityData(supabase, "deal", entityId, orgId)) || "Deal not found.";
      }
      if (query) {
        const { data } = await supabase
          .from("deals")
          .select("id, name, value, stage, probability")
          .eq("organization_id", orgId)
          .ilike("name", `%${query}%`)
          .limit(10);
        return data?.length
          ? `Found ${data.length} deals:\n${data.map((d) => `- ${d.name} ($${d.value || 0}) - ${d.stage}`).join("\n")}`
          : "No deals found matching query.";
      }
      return "Please provide a deal ID or search query.";
    }

    case "customer": {
      if (entityId) {
        return (await fetchEntityData(supabase, "customer", entityId, orgId)) || "Customer not found.";
      }
      if (query) {
        const { data } = await supabase
          .from("customers")
          .select("id, first_name, last_name, email, company, status")
          .eq("organization_id", orgId)
          .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,company.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(10);
        return data?.length
          ? `Found ${data.length} customers:\n${data.map((c) => `- ${c.first_name} ${c.last_name} (${c.company || "N/A"}) - ${c.status}`).join("\n")}`
          : "No customers found matching query.";
      }
      return "Please provide a customer ID or search query.";
    }

    case "competitor": {
      if (entityId) {
        return (await fetchEntityData(supabase, "competitor", entityId, orgId)) || "Competitor not found.";
      }
      if (query) {
        const { data } = await supabase
          .from("competitors")
          .select("id, name, website, category")
          .eq("organization_id", orgId)
          .ilike("name", `%${query}%`)
          .limit(10);
        return data?.length
          ? `Found ${data.length} competitors:\n${data.map((c) => `- ${c.name} (${c.website || "N/A"}) - ${c.category || "N/A"}`).join("\n")}`
          : "No competitors found matching query.";
      }
      return "Please provide a competitor ID or search query.";
    }

    case "pipeline_summary": {
      const { data: deals } = await supabase
        .from("deals")
        .select("name, value, stage, probability, close_date")
        .eq("organization_id", orgId)
        .not("stage", "in", '("closed_won","closed_lost")')
        .order("value", { ascending: false });

      if (!deals?.length) return "No active deals in pipeline.";

      const byStage: Record<string, { count: number; value: number }> = {};
      for (const deal of deals) {
        if (!byStage[deal.stage]) byStage[deal.stage] = { count: 0, value: 0 };
        byStage[deal.stage].count++;
        byStage[deal.stage].value += deal.value || 0;
      }

      const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
      const weightedValue = deals.reduce(
        (sum, d) => sum + (d.value || 0) * ((d.probability || 0) / 100),
        0
      );

      return `**Pipeline Summary**
Total Active Deals: ${deals.length}
Total Pipeline Value: $${totalValue.toLocaleString()}
Weighted Value: $${weightedValue.toLocaleString()}

By Stage:
${Object.entries(byStage)
  .map(([stage, data]) => `- ${stage}: ${data.count} deals ($${data.value.toLocaleString()})`)
  .join("\n")}

Top 5 Deals:
${deals
  .slice(0, 5)
  .map((d) => `- ${d.name}: $${(d.value || 0).toLocaleString()} (${d.stage}, ${d.probability || 0}% prob, close: ${d.close_date || "TBD"})`)
  .join("\n")}`;
    }

    default:
      return `Unknown entity type: ${entityType}`;
  }
}
