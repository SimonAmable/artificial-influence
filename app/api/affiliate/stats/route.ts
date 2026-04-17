import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!affiliate) {
    return NextResponse.json({ affiliate: null })
  }

  const { data: referrals } = await supabase
    .from('affiliate_referrals')
    .select('id, first_converted_at, commission_eligible_until')
    .eq('affiliate_id', affiliate.id)

  const { data: commissions } = await supabase
    .from('affiliate_commissions')
    .select('*')
    .eq('affiliate_id', affiliate.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const totalCommissionCents =
    commissions?.reduce((sum, c) => sum + (c.commission_amount_cents ?? 0), 0) ??
    0

  return NextResponse.json({
    affiliate,
    referrals: referrals ?? [],
    commissions: commissions ?? [],
    totalCommissionCents,
    referralCount: referrals?.length ?? 0,
  })
}
