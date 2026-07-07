import { NextResponse } from "next/server"

import { currentProduct } from "@/lib/product/current"

export function isPresenceProduct(): boolean {
  return currentProduct.id === "presence-studio"
}

export function requirePresenceProductResponse(): NextResponse | null {
  if (!isPresenceProduct()) {
    return NextResponse.json({ error: "Not available for this product." }, { status: 404 })
  }
  return null
}
