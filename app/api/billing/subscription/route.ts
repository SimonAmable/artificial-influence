import { NextResponse } from "next/server"

import { getFanvueBillingSummaryForUser } from "@/lib/fanvue/billing-service"
import { isFanvueBillingProduct } from "@/lib/billing/require-stripe-billing"
import { createClient } from "@/lib/supabase/server"
import { getUserSubscription } from "@/lib/subscription-server"
import { resolvePaidPlanFromPriceId } from "@/lib/pricing-plan-cta"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (isFanvueBillingProduct()) {
      const summary = await getFanvueBillingSummaryForUser(user.id)
      return NextResponse.json({
        isLoggedIn: true,
        ...summary,
        activePlanUuid: summary.planUuid,
        activePlanName: summary.planName,
      })
    }

    const subscription = await getUserSubscription(user.id)
    const paidPlan = resolvePaidPlanFromPriceId(subscription?.price_id ?? null)

    return NextResponse.json({
      billingProvider: "stripe",
      isLoggedIn: true,
      hasSubscription: Boolean(subscription),
      activePriceId: subscription?.price_id ?? null,
      activePlanName: paidPlan?.name ?? (subscription ? "Paid" : "Free"),
      status: subscription?.status ?? "none",
      cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
      currentPeriodEnd: subscription?.current_period_end ?? null,
    })
  } catch (error) {
    console.error("[billing/subscription]", error)
    return NextResponse.json({ error: "Failed to load subscription" }, { status: 500 })
  }
}
