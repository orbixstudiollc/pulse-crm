import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, unauthorized, corsHeaders } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/server'

export async function OPTIONS() {
  return NextResponse.json(null, { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized()

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')
  const limit = Math.min(Number(searchParams.get('limit') || '50'), 250)
  const offset = Number(searchParams.get('offset') || '0')

  try {
    const supabase = createAdminClient()

    let query = supabase
      .from('customers')
      .select(
        'id, first_name, last_name, email, company, status, health_score, mrr, lifetime_value, plan, created_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, count, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders })
    }

    // Map first_name + last_name into a combined name field for convenience
    const customers = (data ?? []).map((c) => ({
      ...c,
      name: `${c.first_name} ${c.last_name}`.trim(),
      company_name: c.company,
    }))

    return NextResponse.json(
      { customers, total: count ?? 0 },
      { headers: corsHeaders }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
