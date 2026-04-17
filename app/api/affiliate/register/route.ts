import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getAffiliateProgramAgreementText } from '@/lib/affiliate/get-affiliate-agreement-text'
import {
  normalizeAffiliateCode,
  validateAffiliateCodeFormat,
} from '@/lib/affiliate/utils'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { code?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const raw = typeof body.code === 'string' ? body.code : ''
  if (!validateAffiliateCodeFormat(raw)) {
    return NextResponse.json(
      { error: 'Code must be 4–20 letters or numbers only' },
      { status: 400 }
    )
  }

  const code = normalizeAffiliateCode(raw)
  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  const { data: taken } = await admin
    .from('affiliates')
    .select('id')
    .eq('code', code)
    .maybeSingle()

  if (taken) {
    return NextResponse.json(
      { error: 'This code is already taken' },
      { status: 409 }
    )
  }

  const { data: existingUserAffiliate } = await admin
    .from('affiliates')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingUserAffiliate) {
    return NextResponse.json(
      { error: 'You already have an affiliate account' },
      { status: 409 }
    )
  }

  const agreedAt = new Date().toISOString()
  const { data: inserted, error: insertError } = await supabase
    .from('affiliates')
    .insert({
      user_id: user.id,
      code,
      agreed_to_terms_at: agreedAt,
      agreed_terms_text: getAffiliateProgramAgreementText(),
      status: 'active',
    })
    .select()
    .single()

  if (insertError) {
    console.error('affiliate register:', insertError)
    return NextResponse.json(
      { error: 'Could not create affiliate account' },
      { status: 500 }
    )
  }

  return NextResponse.json({ affiliate: inserted })
}
