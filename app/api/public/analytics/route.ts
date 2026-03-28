import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, unauthorized, corsHeaders } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/server'

export async function OPTIONS() {
  return NextResponse.json(null, { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized()

  try {
    const supabase = createAdminClient()

    // Run all queries in parallel
    const [
      leadsResult,
      customersResult,
      dealsResult,
      contactsResult,
      proposalsResult,
      activitiesResult,
    ] = await Promise.all([
      supabase.from('leads').select('id, status', { count: 'exact' }),
      supabase.from('customers').select('id, status', { count: 'exact' }),
      supabase.from('deals').select('id, stage, value', { count: 'exact' }),
      supabase.from('contacts').select('id', { count: 'exact' }),
      supabase.from('proposals').select('id', { count: 'exact' }),
      supabase
        .from('activities')
        .select('id, type, title, description, related_type, related_id, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    // Leads breakdown by status
    const leads = leadsResult.data ?? []
    const leadsByStatus: Record<string, number> = {}
    for (const lead of leads) {
      const s = lead.status ?? 'unknown'
      leadsByStatus[s] = (leadsByStatus[s] || 0) + 1
    }

    // Customer counts
    const customers = customersResult.data ?? []
    const activeCustomers = customers.filter((c) => c.status === 'active').length

    // Deals breakdown by stage + pipeline value
    const deals = dealsResult.data ?? []
    const dealsByStage: Record<string, number> = {}
    let totalPipelineValue = 0
    for (const deal of deals) {
      const s = deal.stage ?? 'unknown'
      dealsByStage[s] = (dealsByStage[s] || 0) + 1
      totalPipelineValue += deal.value ?? 0
    }

    const analytics = {
      total_leads: leadsResult.count ?? 0,
      leads_by_status: leadsByStatus,
      total_customers: customersResult.count ?? 0,
      active_customers: activeCustomers,
      total_deals: dealsResult.count ?? 0,
      deals_by_stage: dealsByStage,
      total_pipeline_value: totalPipelineValue,
      total_contacts: contactsResult.count ?? 0,
      total_proposals: proposalsResult.count ?? 0,
      recent_activities: activitiesResult.data ?? [],
    }

    return NextResponse.json(analytics, { headers: corsHeaders })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
