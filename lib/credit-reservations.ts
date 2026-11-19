import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type ReserveCreditsResult = {
  reservationId: string | null
  balanceAfter: number | null
  status: "reserved" | "insufficient" | string
}

export async function reserveUserCredits(
  supabase: SupabaseClient,
  input: {
    userId: string
    amount: number
    idempotencyKey: string
    referenceId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<ReserveCreditsResult> {
  const { data, error } = await supabase.rpc("reserve_credits", {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_idempotency_key: input.idempotencyKey,
    p_reference_id: input.referenceId ?? null,
    p_metadata: input.metadata ?? {},
  })

  if (error) {
    throw new Error(error.message)
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    return { reservationId: null, balanceAfter: null, status: "insufficient" }
  }

  return {
    reservationId: row.reservation_id ?? null,
    balanceAfter: row.balance_after ?? null,
    status: row.reservation_status ?? "reserved",
  }
}

export async function captureCreditReservation(supabase: SupabaseClient, idempotencyKey: string): Promise<void> {
  const { error } = await supabase.rpc("capture_credit_reservation", {
    p_idempotency_key: idempotencyKey,
  })
  if (error) {
    throw new Error(error.message)
  }
}

export async function releaseCreditReservation(supabase: SupabaseClient, idempotencyKey: string): Promise<void> {
  const { error } = await supabase.rpc("release_credit_reservation", {
    p_idempotency_key: idempotencyKey,
  })
  if (error) {
    throw new Error(error.message)
  }
}