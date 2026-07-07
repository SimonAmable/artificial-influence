import { redirect } from "next/navigation"

import { isPresenceProduct } from "@/lib/product/require-presence"

/** Legacy URL: kit creation now uses real IDs from `/brand` (New kit dialog). */
export default function BrandNewLegacyRedirect() {
  if (isPresenceProduct()) {
    redirect("/assets")
  }

  redirect("/assets?tab=brands")
}
