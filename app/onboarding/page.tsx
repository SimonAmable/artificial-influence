import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OnboardingForm } from "@/app/onboarding/onboarding-form"
import {
  mapAutomationRowToOnboardingLearnAutomation,
  ONBOARDING_LEARN_AUTOMATION_ID,
} from "@/lib/onboarding/learn-automation"
import type { AutomationRow } from "@/lib/automations/types"

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
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.onboarding_completed_at) {
    redirect("/dashboard")
  }

  const { data: learnAutomationRow, error: learnAutomationError } = await supabase
    .from("automations")
    .select(
      "id,user_id,name,prompt,cron_schedule,timezone,model,is_active,last_run_at,next_run_at,run_count,last_error,created_at,updated_at,prompt_payload,is_public,preview_captured_at,cloned_from,description,preview_run_id",
    )
    .eq("id", ONBOARDING_LEARN_AUTOMATION_ID)
    .eq("is_public", true)
    .maybeSingle()

  if (learnAutomationError) {
    console.error("[onboarding] featured learn automation:", learnAutomationError)
  }

  const learnAutomation = mapAutomationRowToOnboardingLearnAutomation(
    learnAutomationRow as Partial<AutomationRow> | null,
  )

  return <OnboardingForm userId={user.id} learnAutomation={learnAutomation} />
}
