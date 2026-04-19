import { Suspense } from "react"
import type { Metadata } from "next"

import { CanvasesPage } from "@/components/canvases/canvases-page"
import { FeatureLanding } from "@/components/feature-landing/feature-landing"
import { canvasesLanding } from "@/lib/constants/feature-landings/canvases"
import { buildFeatureLandingMetadata } from "@/lib/seo/feature-landing-metadata"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = buildFeatureLandingMetadata(canvasesLanding)

export const revalidate = 86_400

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <FeatureLanding config={canvasesLanding} />
  }

  return (
    <Suspense fallback={null}>
      <CanvasesPage />
    </Suspense>
  )
}
