import { Suspense } from "react"

import { AutomationsPage } from "@/components/automations/automations-page"

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AutomationsPage />
    </Suspense>
  )
}
