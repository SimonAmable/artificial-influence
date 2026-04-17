import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { DashboardPage } from "@/components/dashboard/dashboard-page"
import { CanvasHeroSection } from "@/components/landing/canvas-hero-section"
// import { WorkflowShowcaseSection } from "@/components/landing/workflow-showcase-section"
import { PlatformSurfacesSection } from "@/components/landing/platform-surfaces-section"
// import { ProcessSection } from "@/components/landing/process-section"
import { ModelsBentoSection } from "@/components/landing/models-bento-section"
import { ProofSection } from "@/components/landing/proof-section"
import { FAQSection } from "@/components/landing/faq-section"
import { FinalCTASection } from "@/components/landing/final-cta-section"
import { Footer } from "@/components/landing/footer"
import { ONBOARDING_DONE_COOKIE } from "@/lib/onboarding/constants"

const HOME_AUTH_TIMEOUT_MS = 2500
const HOME_PROFILE_TIMEOUT_MS = 2500

async function withTimeout<T>(promise: PromiseLike<T>, label: string, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

export default async function Page() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  let user = null

  try {
    const authResult = await withTimeout(supabase.auth.getUser(), "Home auth lookup", HOME_AUTH_TIMEOUT_MS)
    user = authResult.data.user ?? null
  } catch (error) {
    // Fall back to the public landing page when Supabase is flaky so `/`
    // stays usable during local development.
    console.error("Home page auth check failed:", error)
  }

  if (user) {
    try {
      const onboardingCookieUserId = cookieStore.get(ONBOARDING_DONE_COOKIE)?.value

      if (onboardingCookieUserId !== user.id) {
        const { data: profile } = await withTimeout(
          supabase
            .from("profiles")
            .select("onboarding_completed_at")
            .eq("id", user.id)
            .maybeSingle(),
          "Home onboarding profile lookup",
          HOME_PROFILE_TIMEOUT_MS
        )

        if (!profile?.onboarding_completed_at) {
          redirect("/onboarding")
        }
      }
    } catch (error) {
      // Keep signed-in users moving during local Supabase instability.
      console.error("Home onboarding check failed:", error)
    }

    return <DashboardPage />
  }

  return (
    <>
      <CanvasHeroSection />
      <ProofSection />
      {/* <WorkflowShowcaseSection /> */}
      <PlatformSurfacesSection />
      {/* <ProcessSection /> */}
      <ModelsBentoSection />
      <FAQSection />
      <FinalCTASection />
      <Footer />
    </>
  )
}
