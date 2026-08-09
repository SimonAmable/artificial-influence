import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export const ACCOUNT_SUSPENDED_MESSAGE =
  "This account has been suspended. Contact support if you believe this is a mistake."

export async function isUserBanned(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_banned")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("[require-active-user] Failed to load ban status:", error.message)
    return true
  }

  return data?.is_banned === true
}

export async function getUserBanError(
  supabase: SupabaseClient,
  userId: string,
): Promise<Error | null> {
  const banned = await isUserBanned(supabase, userId)
  if (!banned) {
    return null
  }

  return new Error(ACCOUNT_SUSPENDED_MESSAGE)
}

export function isAccountSuspendedError(
  error: Error | null | undefined,
): boolean {
  return error?.message === ACCOUNT_SUSPENDED_MESSAGE
}

export async function requireSessionUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      user: null,
      error: error ?? new Error("Unauthorized"),
    }
  }

  const banError = await getUserBanError(supabase, user.id)
  if (banError) {
    return { user: null, error: banError }
  }

  return { user, error: null }
}

export function bannedJsonResponse() {
  return NextResponse.json({ error: ACCOUNT_SUSPENDED_MESSAGE }, { status: 403 })
}

export function bannedTextResponse() {
  return new Response(JSON.stringify({ error: ACCOUNT_SUSPENDED_MESSAGE }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  })
}

export function authContextFailureResponse(error: Error | null | undefined) {
  if (isAccountSuspendedError(error)) {
    return bannedJsonResponse()
  }

  return NextResponse.json(
    { error: error?.message ?? "Unauthorized" },
    { status: 401 },
  )
}

export function authContextFailureTextResponse(error: Error | null | undefined) {
  if (isAccountSuspendedError(error)) {
    return bannedTextResponse()
  }

  return new Response(JSON.stringify({ error: error?.message ?? "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  })
}
