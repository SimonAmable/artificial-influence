"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

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
