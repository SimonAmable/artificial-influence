import { Suspense } from "react"
import { redirect } from "next/navigation"

import { AutopostPage } from "@/components/autopost/autopost-page"
import { isPresenceProduct } from "@/lib/product/require-presence"

export default function Page() {
  if (isPresenceProduct()) {
    redirect("/content")
  }

  return (
    <Suspense fallback={null}>
      <AutopostPage />
    </Suspense>
  )
}
