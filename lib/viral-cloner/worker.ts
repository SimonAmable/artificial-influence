import "server-only"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { captureCreditReservation, releaseCreditReservation } from "@/lib/credit-reservations"
import { markImportDownloading, markImportFailed, markImportReady } from "@/lib/social-imports/service"
import { persistSocialMediaItem } from "@/lib/social-imports/storage"
import type { SocialImportManifest, SocialMediaItem } from "@/lib/social-imports/types"
import { VIRAL_CLONER_CANONICAL_PROMPT_VERSION, VIRAL_CLONER_IMPORT_CREDIT } from "./constants"
import { quoteViralCloneSelection, resolveGenjutsuBillableSeconds } from "./pricing"
import { resolveViralClonerCharacterReference } from "./resolve-character"
import { submitViralClonerImageGeneration } from "./submit-image"
import { submitViralClonerVideoGeneration } from "./submit-video"
import type { ViralClonerTrimSelection } from "./types"

function getServiceClient() {
  const supabase = createServiceRoleClient()
  if (!supabase) {
    throw new Error("Service role client is required.")
  }
  return supabase
}

export async function processViralCloneJob(jobId: string): Promise<void> {
  const supabase = getServiceClient()

  const { data: job, error: jobError } = await supabase
    .from("viral_clone_jobs")
    .select(
      "id, user_id, social_import_id, character_asset_id, character_storage_path, status, source_url, source_platform, import_reservation_key, import_fee_captured",
    )
    .eq("id", jobId)
    .maybeSingle()

  if (jobError || !job) {
    throw new Error("Viral clone job not found.")
  }

  if (
    job.status !== "importing" &&
    job.status !== "submitting" &&
    job.status !== "processing"
  ) {
    return
  }

  const { data: importRow } = await supabase
    .from("social_media_imports")
    .select("manifest, source_url, source_platform")
    .eq("id", job.social_import_id)
    .maybeSingle()

  const manifest = importRow?.manifest as SocialImportManifest | null
  if (!manifest?.media?.length) {
    await supabase.from("viral_clone_jobs").update({ status: "failed", error_message: "Missing media manifest." }).eq("id", jobId)
    return
  }

  const { data: items } = await supabase
    .from("viral_clone_items")
    .select(
      "id, item_index, media_kind, status, quoted_credits, reservation_key, trim_start_seconds, trim_end_seconds, source_storage_path, source_public_url",
    )
    .eq("job_id", jobId)
    .order("item_index")

  const pendingItems = (items ?? []).filter(
    (item) =>
      item.status === "pending" ||
      item.status === "importing" ||
      item.status === "queued",
  )
  if (pendingItems.length === 0) {
    return
  }

  const needsFreshImport = pendingItems.some(
    (item) =>
      (item.status === "pending" || item.status === "importing") &&
      !(typeof item.source_storage_path === "string" && item.source_storage_path.length > 0),
  )

  const character = await resolveViralClonerCharacterReference({
    supabase,
    userId: job.user_id,
    characterAssetId: job.character_asset_id,
    characterStoragePath: job.character_storage_path,
  })

  const mediaByIndex = new Map<number, SocialMediaItem>()
  for (const entry of manifest.media) {
    mediaByIndex.set(entry.index, entry)
  }

  let importCaptured = Boolean(job.import_fee_captured)
  const storedPaths: Record<number, { publicUrl: string; storagePath: string; durationSeconds: number | null }> = {}

  for (const item of pendingItems) {
    if (
      typeof item.source_storage_path === "string" &&
      item.source_storage_path.length > 0 &&
      typeof item.source_public_url === "string" &&
      item.source_public_url.length > 0
    ) {
      const manifestItem = mediaByIndex.get(item.item_index)
      storedPaths[item.item_index] = {
        publicUrl: item.source_public_url,
        storagePath: item.source_storage_path,
        durationSeconds: manifestItem?.durationSeconds ?? null,
      }
    }
  }

  try {
    if (needsFreshImport) {
      await markImportDownloading(supabase, job.social_import_id)
    }

    for (const item of pendingItems) {
      if (storedPaths[item.item_index]) {
        continue
      }

      const manifestItem = mediaByIndex.get(item.item_index)
      if (!manifestItem) {
        throw new Error(`Missing manifest item ${item.item_index}`)
      }

      await supabase.from("viral_clone_items").update({ status: "importing" }).eq("id", item.id)

      const persisted = await persistSocialMediaItem({
        userId: job.user_id,
        supabase,
        item: manifestItem,
        filePrefix: `viral-cloner/${jobId}`,
      })

      storedPaths[item.item_index] = persisted

      await supabase
        .from("viral_clone_items")
        .update({
          source_public_url: persisted.publicUrl,
          source_storage_path: persisted.storagePath,
        })
        .eq("id", item.id)

      if (!importCaptured && needsFreshImport) {
        await captureCreditReservation(supabase, job.import_reservation_key)
        importCaptured = true
        await supabase.from("viral_clone_jobs").update({ import_fee_captured: true }).eq("id", jobId)
      }
    }

    if (needsFreshImport) {
      await markImportReady(supabase, job.social_import_id, {
        output_public_url: storedPaths[pendingItems[0]?.item_index ?? 0]?.publicUrl ?? null,
        output_storage_path: storedPaths[pendingItems[0]?.item_index ?? 0]?.storagePath ?? null,
      })
    }
  } catch (importError) {
    const message = importError instanceof Error ? importError.message : "Import failed."
    await markImportFailed(supabase, job.social_import_id, message)
    if (!importCaptured) {
      await releaseCreditReservation(supabase, job.import_reservation_key)
    }
    for (const item of pendingItems) {
      await releaseCreditReservation(supabase, item.reservation_key)
      await supabase
        .from("viral_clone_items")
        .update({ status: "failed", error_message: message })
        .eq("id", item.id)
    }
    await supabase.from("viral_clone_jobs").update({ status: "failed", error_message: message }).eq("id", jobId)
    return
  }

  await supabase.from("viral_clone_jobs").update({ status: "submitting" }).eq("id", jobId)

  for (const item of pendingItems) {
    const manifestItem = mediaByIndex.get(item.item_index)
    const stored = storedPaths[item.item_index]
    if (!manifestItem || !stored) continue

    const trim: ViralClonerTrimSelection | null =
      item.trim_start_seconds != null && item.trim_end_seconds != null
        ? {
            startSeconds: Number(item.trim_start_seconds),
            endSeconds: Number(item.trim_end_seconds),
          }
        : null

    const metadata = {
      viralClone: {
        jobId: job.id,
        itemIndex: item.item_index,
        socialImportId: job.social_import_id,
        sourcePlatform: job.source_platform,
        sourceUrl: job.source_url,
        canonicalPromptVersion: VIRAL_CLONER_CANONICAL_PROMPT_VERSION,
      },
    }

    try {
      await supabase.from("viral_clone_items").update({ status: "queued" }).eq("id", item.id)

      if (manifestItem.kind === "image") {
        const result = await submitViralClonerImageGeneration({
          supabase,
          userId: job.user_id,
          characterAssetId: character.characterAssetId,
          characterReferenceUrl: character.referenceImageUrl,
          characterStoragePath: character.referenceStoragePath,
          sourceImageUrl: stored.publicUrl,
          sourceStoragePath: stored.storagePath,
          quotedCredits: item.quoted_credits,
          reservationKey: item.reservation_key,
          metadata,
        })
        await supabase
          .from("viral_clone_items")
          .update({ status: "generating", generation_id: result.generationId })
          .eq("id", item.id)
      } else {
        const durationSeconds = resolveGenjutsuBillableSeconds(stored.durationSeconds ?? manifestItem.durationSeconds, trim)
        const result = await submitViralClonerVideoGeneration({
          supabase,
          userId: job.user_id,
          characterAssetId: character.characterAssetId,
          characterReferenceUrl: character.referenceImageUrl,
          characterStoragePath: character.referenceStoragePath,
          sourceVideoUrl: stored.publicUrl,
          sourceStoragePath: stored.storagePath,
          durationSeconds,
          quotedCredits: item.quoted_credits,
          reservationKey: item.reservation_key,
          metadata,
        })
        await supabase
          .from("viral_clone_items")
          .update({ status: "generating", generation_id: result.generationId })
          .eq("id", item.id)
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Submission failed."
      await releaseCreditReservation(supabase, item.reservation_key)
      await supabase
        .from("viral_clone_items")
        .update({ status: "failed", error_message: message })
        .eq("id", item.id)
    }
  }

  await supabase.from("viral_clone_jobs").update({ status: "processing" }).eq("id", jobId)
}

export function buildImportReservationKey(jobId: string): string {
  return `viral-cloner:${jobId}:import`
}

export function buildItemReservationKey(jobId: string, index: number): string {
  return `viral-cloner:${jobId}:item:${index}`
}

export function buildViralCloneQuoteForSubmit(input: {
  manifest: SocialImportManifest
  selectedIndexes: number[]
  trims: Record<number, ViralClonerTrimSelection>
}) {
  return quoteViralCloneSelection({
    items: input.manifest.media.map((m) => ({
      index: m.index,
      kind: m.kind,
      durationSeconds: m.durationSeconds,
    })),
    selectedIndexes: input.selectedIndexes,
    trims: input.trims,
    includeImportFee: true,
  })
}

export function importCreditAmount(): number {
  return VIRAL_CLONER_IMPORT_CREDIT
}