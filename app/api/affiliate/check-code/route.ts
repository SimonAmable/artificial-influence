import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { normalizeAffiliateCode, validateAffiliateCodeFormat } from '@/lib/affiliate/utils'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.json({ available: false, reason: 'missing' as const })
  }

  const normalized = normalizeAffiliateCode(code)
  if (!validateAffiliateCodeFormat(code)) {
    return NextResponse.json({ available: false, reason: 'invalid' as const })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  const { data: row } = await admin
    .from('affiliates')
    .select('id')
    .eq('code', normalized)
    .maybeSingle()

  return NextResponse.json({ available: !row })
}
