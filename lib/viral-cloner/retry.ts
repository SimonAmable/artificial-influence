import "server-only"

import { randomUUID } from "node:crypto"
import { reserveUserCredits, releaseCreditReservation } from "@/lib/credit-reservations"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { quoteViralCloneSelection } from "./pricing"
import { processViralCloneJob } from "./worker"
import type { ViralClonerTrimSelection } from "./types"
import type { SocialImportManifest } from "@/lib/social-imports/types"

export function buildRetryReservationKey(jobId: string, itemIndex: number, attemptId: string): string {
  return `viral-cloner:${jobId}:item:${itemIndex}:retry:${attemptId}`
}

export async function retryViralCloneItem(input: {
  userId: string
  jobId: string
  itemIndex: number
}): Promise<void> {
  const supabase = createServiceRoleClient()
  if (!supabase) {
    throw new Error("Service role client is required.")
  }

  const { data: job } = await supabase
    .from("viral_clone_jobs")
    .select("id, user_id, social_import_id, import_fee_captured")
    .eq("id", input.jobId)
    .eq("user_id", input.userId)
    .maybeSingle()

  if (!job) {
    throw new Error("Job not found.")
  }

  const { data: item } = await supabase
    .from("viral_clone_items")
    .select("id, status, item_index, media_kind, trim_start_seconds, trim_end_seconds, source_storage_path")
    .eq("job_id", input.jobId)
    .eq("item_index", input.itemIndex)
    .maybeSingle()

  if (!item) {
    throw new Error("Item not found.")
  }

  if (item.status !== "failed") {
    throw new Error("Only failed items can be retried.")
  }

  const { data: importRow } = await supabase
    .from("social_media_imports")
    .select("manifest")
    .eq("id", job.social_import_id)
    .maybeSingle()

  const manifest = importRow?.manifest as SocialImportManifest | null
  const manifestItem = manifest?.media.find((m) => m.index === item.item_index)
  if (!manifestItem) {
    throw new Error("Source manifest item missing.")
  }

  const trims: Record<number, ViralClonerTrimSelection> = {}
  if (item.trim_start_seconds != null && item.trim_end_seconds != null) {
    trims[item.item_index] = {
      startSeconds: Number(item.trim_start_seconds),
      endSeconds: Number(item.trim_end_seconds),
    }
  }

  const quote = quoteViralCloneSelection({
    items: [
      {
        index: manifestItem.index,
        kind: manifestItem.kind,
        durationSeconds: manifestItem.durationSeconds,
      },
    ],
    selectedIndexes: [item.item_index],
    trims,
    includeImportFee: false,
  })

  const line = quote.lines[0]
  if (!line) {
    throw new Error("Could not price retry.")
  }

  const attemptId = randomUUID().slice(0, 8)
  const reservationKey = buildRetryReservationKey(input.jobId, input.itemIndex, attemptId)

  const reserved = await reserveUserCredits(supabase, {
    userId: input.userId,
    amount: line.credits,
    idempotencyKey: reservationKey,
    referenceId: input.jobId,
    metadata: { kind: "viral_cloner_item_retry", itemIndex: item.item_index },
  })

  if (reserved.status === "insufficient") {
    throw new Error("Not enough credits to retry this item.")
  }

  const hasStoredSource = typeof item.source_storage_path === "string" && item.source_storage_path.length > 0

  await supabase
    .from("viral_clone_items")
    .update({
      status: hasStoredSource ? "queued" : "pending",
      quoted_credits: line.credits,
      reservation_key: reservationKey,
      generation_id: null,
      output_url: null,
      error_message: null,
      completed_at: null,
    })
    .eq("id", item.id)

  await supabase.from("viral_clone_jobs").update({ status: "processing", error_message: null }).eq("id", input.jobId)

  try {
    await processViralCloneJob(input.jobId)
  } catch (error) {
    await releaseCreditReservation(supabase, reservationKey)
    throw error
  }
}