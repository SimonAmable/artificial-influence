import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { captureCreditReservation, releaseCreditReservation } from "@/lib/credit-reservations"
import { deductUserCredits } from "@/lib/credits"

export async function settleSuccessfulGenerationCredits(input: {
  supabase: SupabaseClient
  userId: string
  quotedCredits: number
  creditReservationKey?: string | null
}): Promise<void> {
  if (input.creditReservationKey) {
    await captureCreditReservation(input.supabase, input.creditReservationKey)
    return
  }
  await deductUserCredits(input.userId, input.quotedCredits, input.supabase)
}

export async function settleFailedGenerationCredits(input: {
  supabase: SupabaseClient
  creditReservationKey?: string | null
}): Promise<void> {
  if (!input.creditReservationKey) return
  await releaseCreditReservation(input.supabase, input.creditReservationKey)
}