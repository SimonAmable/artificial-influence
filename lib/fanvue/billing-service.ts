import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  creditsForFanvueItemUuid,
  creditsForFanvuePlanUuid,
  fanvueExternalSubscriptionId,
  fanvuePlanDisplayName,
  resolveFanvuePlanKeyFromUuid,
} from "@/lib/fanvue/billing-config"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type FanvueSubscriptionMe = {
  appUuid?: string
  userUuid?: string
  hasActiveSubscription?: boolean
  status?: "active" | "pending" | "cancelled" | "none"
  planUuid?: string | null
  planName?: string | null
  currentPeriodEnd?: string | null
  cancelAtPeriodEnd?: boolean
}

type FanvuePaymentPayload = {
  object?: string
  id?: string
  status?: string
  billing_reason?: "one_time" | "subscription_initial" | "subscription_renewal"
  gross?: number
  purchase_reference?: string
  item?: { uuid?: string | null }
  app?: { uuid?: string | null }
  buyer?: { uuid?: string | null }
}

type FanvueSubscriptionPayload = {
  object?: string
  id?: string
  status?: "active" | "cancelled" | "expired"
  cancel_at_period_end?: boolean
  expires_at?: string | null
  created_at?: string | null
  plan?: { uuid?: string | null }
  app?: { uuid?: string | null }
  buyer?: { uuid?: string | null }
}

function getServiceClient(): SupabaseClient {
  const client = createServiceRoleClient()
  if (!client) {
    throw new Error("Service role client is not configured.")
  }
  return client
}

export async function resolveUserIdFromFanvueBuyer(
  buyerUuid: string | null | undefined
): Promise<string | null> {
  if (!buyerUuid?.trim()) return null
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("social_connections")
    .select("user_id")
    .eq("provider", "fanvue")
    .eq("provider_account_id", buyerUuid.trim())
    .maybeSingle()

  if (error) {
    console.error("[fanvue/billing] resolve buyer failed:", error.message)
    return null
  }
  return data?.user_id ?? null
}

export async function syncUserProFlag(userId: string): Promise<void> {
  const supabase = getServiceClient()
  const { count, error: countError } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])

  if (countError) {
    console.error("[fanvue/billing] pro flag count failed:", countError.message)
    return
  }

  const isPro = (count ?? 0) > 0
  const { error } = await supabase
    .from("profiles")
    .update({ is_pro: isPro, updated_at: new Date().toISOString() })
    .eq("id", userId)

  if (error) {
    console.error("[fanvue/billing] pro flag update failed:", error.message)
  }
}

export async function upsertFanvueSubscription(params: {
  userId: string
  fanvueSubscriptionId: string
  fanvuePlanUuid: string | null
  fanvueBuyerUuid: string | null
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
}): Promise<void> {
  const supabase = getServiceClient()
  const now = new Date().toISOString()
  const externalId = fanvueExternalSubscriptionId(params.fanvueSubscriptionId)

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: params.userId,
      stripe_subscription_id: externalId,
      stripe_customer_id: `fanvue:${params.fanvueBuyerUuid ?? "unknown"}`,
      status: params.status === "cancelled" && params.cancelAtPeriodEnd ? "active" : params.status,
      price_id: params.fanvuePlanUuid ?? "fanvue:unknown",
      quantity: 1,
      cancel_at_period_end: params.cancelAtPeriodEnd,
      current_period_start: params.currentPeriodStart ?? now,
      current_period_end: params.currentPeriodEnd ?? now,
      billing_provider: "fanvue",
      fanvue_subscription_id: params.fanvueSubscriptionId,
      fanvue_plan_uuid: params.fanvuePlanUuid,
      fanvue_buyer_uuid: params.fanvueBuyerUuid,
      updated_at: now,
    },
    { onConflict: "stripe_subscription_id" }
  )

  if (error) {
    throw new Error(error.message)
  }

  await syncUserProFlag(params.userId)
}

export async function grantFanvueMonthlyCredits(params: {
  userId: string
  fanvueSubscriptionId: string
  planUuid: string | null
  invoiceId?: string | null
}): Promise<void> {
  const monthlyCredits = creditsForFanvuePlanUuid(params.planUuid)
  if (monthlyCredits <= 0) {
    console.warn("[fanvue/billing] no credits mapped for plan", params.planUuid)
    return
  }

  const supabase = getServiceClient()
  const externalId = fanvueExternalSubscriptionId(params.fanvueSubscriptionId)

  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("last_credit_grant_date, current_period_start, status")
    .eq("stripe_subscription_id", externalId)
    .maybeSingle()

  if (subError) {
    console.error("[fanvue/billing] subscription lookup failed:", subError.message)
    return
  }

  if (subscription?.last_credit_grant_date && subscription.current_period_start) {
    const lastGrant = new Date(subscription.last_credit_grant_date)
    const periodStart = new Date(subscription.current_period_start)
    if (lastGrant >= periodStart) {
      console.log("[fanvue/billing] credits already granted this period", params.fanvueSubscriptionId)
      return
    }
  }

  const { error: addError } = await supabase.rpc("add_credits", {
    user_id: params.userId,
    credits_to_add: monthlyCredits,
  })

  if (addError) {
    console.error("[fanvue/billing] add_credits failed:", addError.message)
    return
  }

  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({ last_credit_grant_date: new Date().toISOString() })
    .eq("stripe_subscription_id", externalId)

  if (updateError) {
    console.warn("[fanvue/billing] last_credit_grant_date update failed:", updateError.message)
  }

  console.log(
    `[fanvue/billing] granted ${monthlyCredits} credits to ${params.userId}` +
      (params.invoiceId ? ` (invoice ${params.invoiceId})` : "")
  )
}

export async function fulfillFanvueCreditPack(params: {
  userId: string
  itemUuid: string | null
  invoiceId: string
  amountCents: number
}): Promise<void> {
  const credits = creditsForFanvueItemUuid(params.itemUuid)
  if (credits <= 0) {
    console.warn("[fanvue/billing] unknown credit item", params.itemUuid)
    return
  }

  const supabase = getServiceClient()
  const { error } = await supabase.rpc("fulfill_fanvue_credit_purchase", {
    p_invoice_id: params.invoiceId,
    p_user_id: params.userId,
    p_credits: credits,
    p_amount_cents: Math.max(500, params.amountCents),
  })

  if (error) {
    throw new Error(error.message)
  }

  console.log(`[fanvue/billing] fulfilled ${credits} credit pack for ${params.userId}`)
}

export async function recordFanvueWebhookEvent(
  eventId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const supabase = getServiceClient()
  const { error } = await supabase.from("fanvue_webhook_events").insert({
    id: eventId,
    event_type: eventType,
    payload,
  })

  if (!error) return true
  if (error.code === "23505") return false
  throw new Error(error.message)
}

export async function handleFanvueSubscriptionActivated(
  payload: FanvueSubscriptionPayload
): Promise<void> {
  const buyerUuid = payload.buyer?.uuid
  const userId = await resolveUserIdFromFanvueBuyer(buyerUuid)
  if (!userId || !payload.id) {
    console.warn("[fanvue/billing] subscription.activated missing user or id", {
      buyerUuid,
      subscriptionId: payload.id,
    })
    return
  }

  await upsertFanvueSubscription({
    userId,
    fanvueSubscriptionId: payload.id,
    fanvuePlanUuid: payload.plan?.uuid ?? null,
    fanvueBuyerUuid: buyerUuid ?? null,
    status: payload.status === "active" ? "active" : "active",
    cancelAtPeriodEnd: Boolean(payload.cancel_at_period_end),
    currentPeriodStart: payload.created_at ?? new Date().toISOString(),
    currentPeriodEnd: payload.expires_at,
  })
}

export async function handleFanvueSubscriptionCancelChanged(
  payload: FanvueSubscriptionPayload
): Promise<void> {
  const buyerUuid = payload.buyer?.uuid
  const userId = await resolveUserIdFromFanvueBuyer(buyerUuid)
  if (!userId || !payload.id) return

  await upsertFanvueSubscription({
    userId,
    fanvueSubscriptionId: payload.id,
    fanvuePlanUuid: payload.plan?.uuid ?? null,
    fanvueBuyerUuid: buyerUuid ?? null,
    status: payload.cancel_at_period_end ? "active" : payload.status ?? "active",
    cancelAtPeriodEnd: Boolean(payload.cancel_at_period_end),
    currentPeriodEnd: payload.expires_at,
  })
}

export async function handleFanvuePaymentSucceeded(payload: FanvuePaymentPayload): Promise<void> {
  const buyerUuid = payload.buyer?.uuid
  const userId = await resolveUserIdFromFanvueBuyer(buyerUuid)
  if (!userId) {
    console.warn("[fanvue/billing] payment.succeeded buyer not linked", buyerUuid)
    return
  }

  const billingReason = payload.billing_reason
  const invoiceId = payload.id ?? `fanvue-payment-${Date.now()}`
  const amountCents = typeof payload.gross === "number" ? payload.gross : 0

  if (billingReason === "one_time") {
    await fulfillFanvueCreditPack({
      userId,
      itemUuid: payload.item?.uuid ?? null,
      invoiceId,
      amountCents,
    })
    return
  }

  if (billingReason === "subscription_initial" || billingReason === "subscription_renewal") {
    const subscriptionId = payload.purchase_reference
    if (!subscriptionId) {
      console.warn("[fanvue/billing] payment missing purchase_reference", payload.id)
      return
    }

    await grantFanvueMonthlyCredits({
      userId,
      fanvueSubscriptionId: subscriptionId,
      planUuid: payload.item?.uuid ?? null,
      invoiceId,
    })
  }
}

export function parseFanvueSubscriptionMe(raw: unknown): FanvueSubscriptionMe | null {
  if (!raw || typeof raw !== "object") return null
  return raw as FanvueSubscriptionMe
}

export function fanvuePlanNameFromUuid(planUuid: string | null | undefined): string | null {
  const key = resolveFanvuePlanKeyFromUuid(planUuid)
  return key ? fanvuePlanDisplayName(key) : null
}

export async function getFanvueBillingSummaryForUser(userId: string) {
  const supabase = getServiceClient()
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("billing_provider", "fanvue")
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!subscription) {
    return {
      billingProvider: "fanvue" as const,
      hasSubscription: false,
      planUuid: null as string | null,
      planName: "Free" as string,
      status: "none" as const,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null as string | null,
    }
  }

  return {
    billingProvider: "fanvue" as const,
    hasSubscription: true,
    planUuid: subscription.fanvue_plan_uuid as string | null,
    planName:
      fanvuePlanNameFromUuid(subscription.fanvue_plan_uuid as string | null) ?? "Paid",
    status: subscription.status as string,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    currentPeriodEnd: subscription.current_period_end as string | null,
  }
}
