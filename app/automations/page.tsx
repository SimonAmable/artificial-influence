import { Suspense } from "react"
import type { Metadata } from "next"

import { AutomationsPage } from "@/components/automations/automations-page"
import { AutomationLogoConnection } from "@/components/landing/automation-logo-connection"
import { FeatureLanding } from "@/components/feature-landing/feature-landing"
import { automationsLanding } from "@/lib/constants/feature-landings/automations"
import { buildFeatureLandingMetadata } from "@/lib/seo/feature-landing-metadata"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = buildFeatureLandingMetadata(automationsLanding)

export const revalidate = 86_400

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <FeatureLanding
        config={automationsLanding}
        slots={{
          afterHero: (
            <div className="border-b border-border/60 bg-background px-4 py-8 lg:px-8">
              <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-border/60">
                <AutomationLogoConnection fillContainer className="min-h-[240px]" />
              </div>
            </div>
          ),
        }}
      />
    )
  }

  return (
    <Suspense fallback={null}>
      <AutomationsPage />
    </Suspense>
  )
}
