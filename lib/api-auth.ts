import { NextRequest, NextResponse } from 'next/server'

export function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  return apiKey === process.env.PULSE_CRM_API_KEY
}

export function unauthorized() {
  return NextResponse.json(
    { error: 'Unauthorized — invalid or missing x-api-key' },
    { status: 401 }
  )
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'x-api-key, Content-Type',
}
