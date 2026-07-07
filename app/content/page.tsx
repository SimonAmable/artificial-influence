import { Suspense } from "react"
import { redirect } from "next/navigation"

import { ContentShell } from "@/components/content/content-shell"
import { isPresenceProduct } from "@/lib/product/require-presence"

export default function ContentPage() {
  if (!isPresenceProduct()) {
    redirect("/autopost")
  }

  return (
    <Suspense fallback={null}>
      <ContentShell />
    </Suspense>
  )
}
