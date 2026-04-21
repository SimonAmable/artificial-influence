"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { getCurrentTermsDocument, setTermsVersionCookie } from "@/lib/legal/terms-acceptance"
import { createClient } from "@/lib/supabase/server"
import { ONBOARDING_DONE_COOKIE } from "@/lib/onboarding/constants"
import {
  completeOnboardingPayloadSchema,
  type CompleteOnboardingPayload,
  type OnboardingJsonData,
} from "@/lib/onboarding/payload-schema"

export type CompleteOnboardingResult =
  | { ok: true }
  | { ok: false; error: string }

export async function completeOnboarding(
  payload: CompleteOnboardingPayload
): Promise<CompleteOnboardingResult> {
  const parsed = completeOnboardingPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "Invalid data"
    return { ok: false, error: msg }
  }
  const data = parsed.data
  const completedAt = new Date().toISOString()
  const currentTerms = getCurrentTermsDocument()
  const onboardingJsonData: OnboardingJsonData = {
    ...data,
    completedAt,
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Not signed in" }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_completed_at: completedAt,
      full_name: data.fullName,
      onboarding_json_data: onboardingJsonData,
      terms_accepted_at: completedAt,
      terms_version: currentTerms.version,
      terms_text_snapshot: currentTerms.content,
      terms_acceptance_source: "onboarding",
    })
    .eq("id", user.id)

  if (error) {
    console.error("[onboarding] completeOnboarding", error)
    return { ok: false, error: error.message }
  }

  const cookieStore = await cookies()
  cookieStore.set(ONBOARDING_DONE_COOKIE, user.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  })
  await setTermsVersionCookie(currentTerms.version)

  revalidatePath("/", "layout")
  return { ok: true }
}
