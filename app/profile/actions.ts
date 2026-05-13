"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"

import { createClient } from "@/lib/supabase/server"
import { ONBOARDING_DONE_COOKIE } from "@/lib/onboarding/constants"

export type UpdateProfileDisplayNameResult =
  | { ok: true }
  | { ok: false; error: string }

const MAX_NAME_LENGTH = 120

export async function updateProfileDisplayName(
  fullName: string
): Promise<UpdateProfileDisplayNameResult> {
  const trimmed = fullName.trim()
  if (!trimmed) {
    return { ok: false, error: "Name cannot be empty" }
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      error: `Name must be at most ${MAX_NAME_LENGTH} characters`,
    }
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
    .update({ full_name: trimmed })
    .eq("id", user.id)

  if (error) {
    console.error("[profile] updateProfileDisplayName", error)
    return { ok: false, error: error.message }
  }

  revalidatePath("/profile")
  return { ok: true }
}

export type RestartOnboardingResult =
  | { ok: true }
  | { ok: false; error: string }

/** Clears completion so `/onboarding` is reachable again; keeps `onboarding_json_data` for safe prefill. */
export async function restartOnboarding(): Promise<RestartOnboardingResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "Not signed in" }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed_at: null })
    .eq("id", user.id)

  if (error) {
    console.error("[profile] restartOnboarding", error)
    return { ok: false, error: error.message }
  }

  const cookieStore = await cookies()
  cookieStore.set(ONBOARDING_DONE_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  })

  revalidatePath("/", "layout")
  revalidatePath("/profile")
  revalidatePath("/onboarding")
  revalidatePath("/chat", "layout")
  return { ok: true }
}
