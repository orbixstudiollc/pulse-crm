import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, unauthorized, corsHeaders } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/server'

export async function OPTIONS() {
  return NextResponse.json(null, { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized()

  const { searchParams } = request.nextUrl
  const stage = searchParams.get('stage')
  const limit = Math.min(Number(searchParams.get('limit') || '50'), 250)
  const offset = Number(searchParams.get('offset') || '0')

  try {
    const supabase = createAdminClient()

    let query = supabase
      .from('deals')
      .select(
        'id, name, value, stage, probability, contact_name, contact_email, close_date, created_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (stage) {
      query = query.eq('stage', stage)
    }

    const { data, count, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders })
    }

    // Map close_date to expected_close_date for API consumers
    const deals = (data ?? []).map((d) => ({
      ...d,
      expected_close_date: d.close_date,
    }))

    return NextResponse.json(
      { deals, total: count ?? 0 },
      { headers: corsHeaders }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
