import { NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"
import { randomUUID } from "node:crypto"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { reserveUserCredits } from "@/lib/credit-reservations"
import { getOwnedImportManifest } from "@/lib/social-imports/service"
import { quoteViralCloneSelection } from "@/lib/viral-cloner/pricing"
import type { ViralClonerTrimSelection } from "@/lib/viral-cloner/types"
import {
  buildImportReservationKey,
  buildItemReservationKey,
  processViralCloneJob,
} from "@/lib/viral-cloner/worker"
import { VIRAL_CLONER_IMPORT_CREDIT } from "@/lib/viral-cloner/constants"
import { createClient } from "@/lib/supabase/server"

type CreateViralCloneBody = {
  importId?: string
  characterAssetId?: string | null
  characterUploadId?: string | null
  characterStoragePath?: string | null
  selectedItemIndexes?: number[]
  trims?: Record<string, ViralClonerTrimSelection>
  acceptedRightToUse?: boolean
  idempotencyKey?: string
}

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Sign in to clone social media." }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as CreateViralCloneBody
    const importId = typeof body.importId === "string" ? body.importId.trim() : ""
    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim().length >= 8
        ? body.idempotencyKey.trim()
        : randomUUID()

    if (!importId) {
      return NextResponse.json({ error: "Inspect a post URL first." }, { status: 400 })
    }
    if (body.acceptedRightToUse !== true) {
      return NextResponse.json({ error: "Confirm you have rights to clone this media." }, { status: 400 })
    }

    const characterAssetId =
      typeof body.characterAssetId === "string" && body.characterAssetId.trim()
        ? body.characterAssetId.trim()
        : null
    const characterStoragePath =
      typeof body.characterStoragePath === "string" && body.characterStoragePath.trim()
        ? body.characterStoragePath.trim()
        : null

    if (!characterAssetId && !characterStoragePath) {
      return NextResponse.json(
        { error: "Choose a reference character from the library or upload a face image." },
        { status: 400 },
      )
    }

    const { manifest } = await getOwnedImportManifest({
      supabase,
      userId: user.id,
      importId,
    })

    const selectedItemIndexes = Array.isArray(body.selectedItemIndexes)
      ? body.selectedItemIndexes.filter((value) => Number.isInteger(value))
      : manifest.media.map((item) => item.index)

    const trims: Record<number, ViralClonerTrimSelection> = {}
    if (body.trims && typeof body.trims === "object") {
      for (const [key, value] of Object.entries(body.trims)) {
        const index = Number(key)
        if (!Number.isInteger(index) || !value) continue
        trims[index] = value
      }
    }

    const quote = quoteViralCloneSelection({
      items: manifest.media.map((item) => ({
        index: item.index,
        kind: item.kind,
        durationSeconds: item.durationSeconds,
      })),
      selectedIndexes: selectedItemIndexes,
      trims,
      includeImportFee: true,
    })

    const serviceSupabase = createServiceRoleClient()
    if (!serviceSupabase) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 })
    }

    const { data: existingJob } = await supabase
      .from("viral_clone_jobs")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle()

    if (existingJob?.id) {
      return NextResponse.json({ jobId: existingJob.id })
    }

    const jobId = randomUUID()
    const importReservationKey = buildImportReservationKey(jobId)

    const importReserve = await reserveUserCredits(serviceSupabase, {
      userId: user.id,
      amount: VIRAL_CLONER_IMPORT_CREDIT,
      idempotencyKey: importReservationKey,
      referenceId: jobId,
      metadata: { kind: "viral_cloner_import" },
    })

    if (importReserve.status === "insufficient") {
      return NextResponse.json({ error: "Not enough credits for the import fee." }, { status: 402 })
    }

    for (const line of quote.lines) {
      const itemKey = buildItemReservationKey(jobId, line.index)
      const reserved = await reserveUserCredits(serviceSupabase, {
        userId: user.id,
        amount: line.credits,
        idempotencyKey: itemKey,
        referenceId: jobId,
        metadata: { kind: "viral_cloner_item", itemIndex: line.index },
      })
      if (reserved.status === "insufficient") {
        return NextResponse.json({ error: "Not enough credits for the selected items." }, { status: 402 })
      }
    }

    const { error: jobError } = await supabase.from("viral_clone_jobs").insert({
      id: jobId,
      user_id: user.id,
      social_import_id: importId,
      character_asset_id: characterAssetId,
      character_storage_path: characterStoragePath,
      idempotency_key: idempotencyKey,
      status: "importing",
      source_url: manifest.canonicalUrl,
      source_platform: manifest.platform,
      source_title: manifest.sourceTitle,
      quoted_credits_total: quote.totalCredits,
      import_reservation_key: importReservationKey,
      accepted_right_to_use: true,
    })

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 })
    }

    const itemRows = quote.lines.map((line) => ({
      job_id: jobId,
      item_index: line.index,
      media_kind: line.kind,
      trim_start_seconds: trims[line.index]?.startSeconds ?? null,
      trim_end_seconds: trims[line.index]?.endSeconds ?? null,
      status: "pending",
      quoted_credits: line.credits,
      reservation_key: buildItemReservationKey(jobId, line.index),
    }))

    const { error: itemsError } = await supabase.from("viral_clone_items").insert(itemRows)
    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    waitUntil(processViralCloneJob(jobId))

    return NextResponse.json({ jobId }, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start cloning."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}