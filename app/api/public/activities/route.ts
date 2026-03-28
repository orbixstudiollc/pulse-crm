import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, unauthorized, corsHeaders } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/server'

export async function OPTIONS() {
  return NextResponse.json(null, { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized()

  const { searchParams } = request.nextUrl
  const type = searchParams.get('type')
  const limit = Math.min(Number(searchParams.get('limit') || '20'), 100)
  const offset = Number(searchParams.get('offset') || '0')

  try {
    const supabase = createAdminClient()

    let query = supabase
      .from('activities')
      .select(
        'id, type, title, description, related_type, related_id, created_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq('type', type)
    }

    const { data, count, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders })
    }

    return NextResponse.json(
      { activities: data ?? [], total: count ?? 0 },
      { headers: corsHeaders }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
