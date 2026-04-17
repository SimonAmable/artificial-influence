import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAffiliateProgramAgreementText } from '@/lib/affiliate/get-affiliate-agreement-text'
import { AffiliateLegalModal } from '@/components/affiliate/affiliate-legal-modal'
import { AffiliateDashboard } from '@/components/affiliate/affiliate-dashboard'

export default async function AffiliatePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/affiliate')
  }

  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!affiliate) {
    return (
      <AffiliateLegalModal
        agreementText={getAffiliateProgramAgreementText()}
      />
    )
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
    .limit(50)

  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return (
    <AffiliateDashboard
      appOrigin={appOrigin}
      affiliate={affiliate}
      referrals={referrals ?? []}
      commissions={commissions ?? []}
    />
  )
}
