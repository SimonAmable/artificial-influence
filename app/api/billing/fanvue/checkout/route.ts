import { NextRequest, NextResponse } from "next/server"

import { isFanvueBillingProduct } from "@/lib/billing/require-stripe-billing"
import {
  getFanvueAppStoreListingUrl,
  getFanvueCheckoutUrl,
  getFanvueCreditCheckoutUrl,
  type FanvueCreditItemKey,
  type FanvuePlanKey,
} from "@/lib/fanvue/app-store"

const PLAN_KEYS: FanvuePlanKey[] = ["free", "starter", "pro"]
const ITEM_KEYS: FanvueCreditItemKey[] = ["200", "500", "1000", "2000"]

export async function POST(request: NextRequest) {
  if (!isFanvueBillingProduct()) {
    return NextResponse.json({ error: "Fanvue billing is not enabled for this product." }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { kind, plan, item } = body as {
    kind?: string
    plan?: string
    item?: string
  }

  let url: string | null = null

  switch (kind) {
    case "listing":
      url = getFanvueAppStoreListingUrl()
      break
    case "plan": {
      if (!plan || !PLAN_KEYS.includes(plan as FanvuePlanKey)) {
        return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
      }
      url = getFanvueCheckoutUrl(plan as FanvuePlanKey, { action: "checkout" })
      break
    }
    case "item": {
      if (!item || !ITEM_KEYS.includes(item as FanvueCreditItemKey)) {
        return NextResponse.json({ error: "Invalid credit item" }, { status: 400 })
      }
      url = getFanvueCreditCheckoutUrl(item as FanvueCreditItemKey, { action: "checkout" })
      break
    }
    default:
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 })
  }

  if (!url) {
    return NextResponse.json(
      { error: "Fanvue billing is not configured yet." },
      { status: 503 }
    )
  }

  return NextResponse.json({ url })
}
