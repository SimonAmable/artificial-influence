import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { MODEL_IDENTIFIERS } from "@/lib/constants/models"
import { submitFalVideoQueue } from "@/lib/server/fal-video"
import { buildGenjutsuFalRequest } from "@/lib/video/genjutsu/request"
import { buildGenjutsuPrompt } from "@/lib/video/genjutsu/prompt"
import { resolveGenjutsuDuration } from "@/lib/video/genjutsu/duration"
import { GENJUTSU_UI_MODEL } from "@/lib/video/genjutsu/constants"
import { VIRAL_CLONER_TOOL } from "./constants"
import { buildViralClonerGenjutsuEdit } from "./prompt"
import type { ViralCloneMetadata } from "./types"

export async function submitViralClonerVideoGeneration(input: {
  supabase: SupabaseClient
  userId: string
  characterAssetId: string | null
  characterReferenceUrl: string
  characterStoragePath: string | null
  sourceVideoUrl: string
  sourceStoragePath: string | null
  durationSeconds: number
  quotedCredits: number
  reservationKey: string
  metadata: ViralCloneMetadata
}): Promise<{ generationId: string; predictionId: string; falEndpoint: string }> {
  if (!process.env.FAL_KEY) {
    throw new Error("FAL_KEY is not configured.")
  }

  const edit = buildViralClonerGenjutsuEdit()
  const prompt = buildGenjutsuPrompt(1, edit)
  const falRequest = buildGenjutsuFalRequest({
    durationSeconds: resolveGenjutsuDuration(input.durationSeconds),
    prompt,
    referenceImageUrls: [input.characterReferenceUrl],
    referenceVideoUrl: input.sourceVideoUrl,
  })

  const { requestId, endpointId } = await submitFalVideoQueue(falRequest.endpointId, falRequest.input)

  const imagePaths = input.characterStoragePath ? [input.characterStoragePath] : []
  const videoPaths = input.sourceStoragePath ? [input.sourceStoragePath] : []

  const { data, error } = await input.supabase
    .from("generations")
    .insert({
      user_id: input.userId,
      prompt,
      supabase_storage_path: null,
      reference_images_supabase_storage_path: imagePaths.length > 0 ? imagePaths : null,
      reference_videos_supabase_storage_path: videoPaths.length > 0 ? videoPaths : null,
      aspect_ratio: "adaptive",
      model: GENJUTSU_UI_MODEL,
      type: "video",
      is_public: true,
      tool: VIRAL_CLONER_TOOL,
      status: "pending",
      replicate_prediction_id: requestId,
      fal_request_id: requestId,
      fal_endpoint_id: endpointId,
      quoted_credits: input.quotedCredits,
      credit_reservation_key: input.reservationKey,
      character_asset_id: input.characterAssetId,
      metadata: input.metadata,
    })
    .select("id")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create video generation.")
  }

  return { generationId: data.id, predictionId: requestId, falEndpoint: endpointId }
}