import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import {
  AFFILIATE_COMMISSION_RATE,
  addCommissionEligibilityEnd,
  normalizeAffiliateCode,
} from '@/lib/affiliate/utils'

/**
 * Idempotent: creates referral row on first qualifying conversion when an affiliate code is present.
 */
export async function ensureAffiliateReferral(
  supabase: SupabaseClient,
  params: { referredUserId: string; affiliateCodeRaw: string | undefined | null }
): Promise<void> {
  const code = params.affiliateCodeRaw
    ? normalizeAffiliateCode(params.affiliateCodeRaw)
    : ''
  if (!code) return

  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('id, user_id')
    .eq('code', code)
    .eq('status', 'active')
    .maybeSingle()

  if (!affiliate || affiliate.user_id === params.referredUserId) return

  const { data: existing } = await supabase
    .from('affiliate_referrals')
    .select('id')
    .eq('referred_user_id', params.referredUserId)
    .maybeSingle()

  if (existing) return

  const now = new Date()
  const eligibleUntil = addCommissionEligibilityEnd(now)

  const { error } = await supabase.from('affiliate_referrals').insert({
    affiliate_id: affiliate.id,
    referred_user_id: params.referredUserId,
    first_converted_at: now.toISOString(),
    commission_eligible_until: eligibleUntil.toISOString(),
  })

  if (error) {
    console.error('ensureAffiliateReferral insert error:', error)
  }
}

/**
 * Records commission for a paid invoice when the customer is still within the eligibility window.
 */
export async function recordAffiliateCommissionFromInvoice(
  supabase: SupabaseClient,
  params: { invoice: Stripe.Invoice; subscription: Stripe.Subscription }
): Promise<void> {
  const userId = params.subscription.metadata?.userId
  if (!userId) return

  const nowIso = new Date().toISOString()

  const { data: referral } = await supabase
    .from('affiliate_referrals')
    .select('id, affiliate_id')
    .eq('referred_user_id', userId)
    .gt('commission_eligible_until', nowIso)
    .maybeSingle()

  if (!referral) return

  const amountPaid = params.invoice.amount_paid
  if (typeof amountPaid !== 'number' || amountPaid <= 0) return

  const commissionCents = Math.floor(amountPaid * AFFILIATE_COMMISSION_RATE)
  const invoiceId = params.invoice.id
  if (!invoiceId) return

  const { error } = await supabase.from('affiliate_commissions').insert({
    affiliate_id: referral.affiliate_id,
    referral_id: referral.id,
    stripe_invoice_id: invoiceId,
    invoice_amount_cents: amountPaid,
    commission_rate: AFFILIATE_COMMISSION_RATE,
    commission_amount_cents: commissionCents,
    currency: (params.invoice.currency || 'usd').toLowerCase(),
    status: 'pending',
  })

  if (error) {
    if (error.code === '23505') {
      return
    }
    console.error('recordAffiliateCommissionFromInvoice error:', error)
  }
}
