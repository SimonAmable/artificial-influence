import { Suspense } from "react"
import type { Metadata } from "next"

import { AutomationsPage } from "@/components/automations/automations-page"
import { automationsLanding } from "@/lib/constants/feature-landings/automations"
import { buildFeatureLandingMetadata } from "@/lib/seo/feature-landing-metadata"

export const metadata: Metadata = buildFeatureLandingMetadata(automationsLanding)

export const revalidate = 86_400

/**
 * Auth is resolved client-side in AutomationsPage.
 * Avoid server getUser()/cookies() here — that makes the route dynamic and
 * re-runs on every soft RSC refresh (cookie/session updates), which spam-fetches GET /automations.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <AutomationsPage />
    </Suspense>
  )
}
