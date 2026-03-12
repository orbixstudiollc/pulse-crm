"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "./helpers";

// ── Meeting Brief Generation ────────────────────────────────────────────────

export async function generateMeetingBrief(leadId: string) {
  const supabase = await createClient();
  const orgId = await getOrgId();

  // 1. Fetch lead data
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("organization_id", orgId)
    .single();

  if (leadError) return { error: leadError.message, data: null };
  if (!lead) return { error: "Lead not found", data: null };

  // 2. Fetch deals for this org (deals don't have lead_id, so fetch all org deals)
  const { data: deals } = await supabase
    .from("deals")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(10);

  // 3. Fetch recent activities (last 30 days) related to this lead
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentActivities } = await supabase
    .from("activities")
    .select("*")
    .eq("organization_id", orgId)
    .eq("related_entity_type", "lead")
    .eq("related_entity_id", leadId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false });

  // 4. Fetch competitor context (lead_competitors + competitors + battle_cards)
  const { data: leadCompetitors } = await supabase
    .from("lead_competitors")
    .select("*")
    .eq("lead_id", leadId);

  let competitiveContext: Array<{
    competitor: Record<string, unknown>;
    link: Record<string, unknown>;
    battleCard: Record<string, unknown> | null;
  }> = [];

  if (leadCompetitors && leadCompetitors.length > 0) {
    const competitorIds = leadCompetitors.map((lc) => lc.competitor_id);

    const { data: competitorDetails } = await supabase
      .from("competitors")
      .select("*")
      .in("id", competitorIds);

    const { data: battleCards } = await supabase
      .from("battle_cards")
      .select("*")
      .in("competitor_id", competitorIds);

    competitiveContext = (competitorDetails ?? []).map((comp) => ({
      competitor: comp,
      link: leadCompetitors.find((lc) => lc.competitor_id === comp.id) ?? {},
      battleCard:
        (battleCards ?? []).find((bc) => bc.competitor_id === comp.id) ?? null,
    }));
  }

  // 5. Return structured brief
  return {
    data: {
      leadInfo: {
        name: lead.name,
        company: lead.company,
        industry: lead.industry,
        score: lead.score,
        status: lead.status,
        icpMatchScore: lead.icp_match_score,
        email: lead.email,
        phone: lead.phone,
        website: lead.website,
        estimatedValue: lead.estimated_value,
      },
      dealInfo: (deals ?? []).map((deal) => ({
        id: deal.id,
        name: deal.name,
        value: deal.value,
        stage: deal.stage,
        probability: deal.probability,
        closeDate: deal.close_date,
        notes: deal.notes,
      })),
      recentActivities: (recentActivities ?? []).map((activity) => ({
        id: activity.id,
        type: activity.type,
        title: activity.title,
        description: activity.description,
        status: activity.status,
        createdAt: activity.created_at,
      })),
      competitiveContext,
      qualificationData: lead.qualification_data
        ? {
            qualificationData: lead.qualification_data,
            qualificationGrade: lead.qualification_grade,
          }
        : null,
      briefGeneratedAt: new Date().toISOString(),
    },
  };
}
