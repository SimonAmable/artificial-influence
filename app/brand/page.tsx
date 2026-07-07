import { redirect } from "next/navigation"

import { isPresenceProduct } from "@/lib/product/require-presence"

export default function BrandHubLegacyRedirect() {
  if (isPresenceProduct()) {
    redirect("/assets")
  }

  redirect("/assets?tab=brands")
}
