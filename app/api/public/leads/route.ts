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
  const sort = searchParams.get('sort') || 'created_at'

  const allowedSorts = ['score', 'created_at', 'name', 'win_probability', 'icp_match_score', 'last_contacted_at']
  const sortColumn = allowedSorts.includes(sort) ? sort : 'created_at'

  try {
    const supabase = createAdminClient()

    const query = supabase
      .from('leads')
      .select(
        'id, name, email, company, status, score, icp_match_score, qualification_grade, qualification_score, win_probability, source, last_contacted_at, next_followup, created_at, tags',
        { count: 'exact' }
      )
      .order(sortColumn, { ascending: false })
      .range(offset, offset + limit - 1)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, count, error } = status
      ? await query.eq('status', status as any)
      : await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders })
    }

    return NextResponse.json(
      { leads: data ?? [], total: count ?? 0 },
      { headers: corsHeaders }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
