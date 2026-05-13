import { redirect } from "next/navigation"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { OnboardingForm } from "@/app/onboarding/onboarding-form"
import { parseStoredOnboardingPrefill } from "@/lib/onboarding/prefill"
import type { CompleteOnboardingPayload } from "@/lib/onboarding/payload-schema"

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, onboarding_json_data, full_name")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.onboarding_completed_at) {
    redirect("/chat")
  }

  const fromSnapshot = parseStoredOnboardingPrefill(profile?.onboarding_json_data)
  const initialPrefill: Partial<CompleteOnboardingPayload> = { ...fromSnapshot }
  if (!initialPrefill.fullName) {
    const fallback = profile?.full_name?.trim()
    if (fallback && fallback.length <= 200) {
      initialPrefill.fullName = fallback
    }
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
          Loading…
        </div>
      }
    >
      <OnboardingForm
        userId={user.id}
        initialPrefill={Object.keys(initialPrefill).length > 0 ? initialPrefill : null}
      />
    </Suspense>
  )
}
