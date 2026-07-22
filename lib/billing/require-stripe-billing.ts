import "server-only"

import { NextResponse } from "next/server"

import { currentProduct } from "@/lib/product/current"

export function isStripeBillingProduct(): boolean {
  return currentProduct.billingProvider === "stripe"
}

export function isFanvueBillingProduct(): boolean {
  return currentProduct.billingProvider === "fanvue"
}

/** Returns a 400 response when Stripe checkout/portal must not run (Fanvue products). */
export function rejectStripeBillingRoute(): NextResponse | null {
  if (isStripeBillingProduct()) {
    return null
  }

  return NextResponse.json(
    {
      error:
        "Billing for this product is managed through the Fanvue App Store. Open Pricing to subscribe or buy credits.",
    },
    { status: 400 }
  )
}
