import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, unauthorized, corsHeaders } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/server'

export async function OPTIONS() {
  return NextResponse.json(null, { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorized()

  const { searchParams } = request.nextUrl
  const limit = Math.min(Number(searchParams.get('limit') || '50'), 250)
  const offset = Number(searchParams.get('offset') || '0')

  try {
    const supabase = createAdminClient()

    const { data, count, error } = await supabase
      .from('contacts')
      .select(
        'id, name, title, email, phone, lead_id, customer_id, buying_role, influence_level, created_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders })
    }

    return NextResponse.json(
      { contacts: data ?? [], total: count ?? 0 },
      { headers: corsHeaders }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
