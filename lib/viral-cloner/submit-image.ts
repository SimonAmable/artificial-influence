import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { MODEL_IDENTIFIERS } from "@/lib/constants/models"
import { buildQwenImage21WaveSpeedRequest } from "@/lib/server/wavespeed-qwen-image-21-request"
import { submitWaveSpeedPrediction } from "@/lib/server/wavespeed-video"
import { wavespeedStoredEndpoint } from "@/lib/server/wavespeed-wan30-request"
import {
  readViralClonerQwenLoraPath,
  readViralClonerQwenLoraScale,
  VIRAL_CLONER_QWEN_RESOLUTION,
  VIRAL_CLONER_TOOL,
} from "./constants"
import { buildViralClonerImagePrompt } from "./prompt"
import type { ViralCloneMetadata } from "./types"

export async function submitViralClonerImageGeneration(input: {
  supabase: SupabaseClient
  userId: string
  characterAssetId: string | null
  characterReferenceUrl: string
  characterStoragePath: string | null
  sourceImageUrl: string
  sourceStoragePath: string | null
  quotedCredits: number
  reservationKey: string
  metadata: ViralCloneMetadata
}): Promise<{ generationId: string; predictionId: string }> {
  if (!process.env.WAVESPEED_API_KEY) {
    throw new Error("WAVESPEED_API_KEY is not configured.")
  }

  const prompt = buildViralClonerImagePrompt()
  const waveSpeedRequest = buildQwenImage21WaveSpeedRequest({
    prompt,
    referenceImageUrls: [input.characterReferenceUrl, input.sourceImageUrl],
    aspectRatio: null,
    resolution: VIRAL_CLONER_QWEN_RESOLUTION,
    outputFormat: "png",
    seed: null,
    loras: [{ path: readViralClonerQwenLoraPath(), scale: readViralClonerQwenLoraScale() }],
  })

  const requestId = await submitWaveSpeedPrediction(waveSpeedRequest.endpoint, waveSpeedRequest.input)

  const referencePaths = [input.characterStoragePath, input.sourceStoragePath].filter(
    (path): path is string => typeof path === "string" && path.length > 0,
  )

  const { data, error } = await input.supabase
    .from("generations")
    .insert({
      user_id: input.userId,
      prompt,
      supabase_storage_path: null,
      reference_images_supabase_storage_path: referencePaths.length > 0 ? referencePaths : null,
      aspect_ratio: waveSpeedRequest.resolvedAspectRatio,
      model: MODEL_IDENTIFIERS.QWEN_IMAGE_21,
      type: "image",
      is_public: true,
      tool: VIRAL_CLONER_TOOL,
      status: "pending",
      replicate_prediction_id: requestId,
      fal_request_id: requestId,
      fal_endpoint_id: wavespeedStoredEndpoint(waveSpeedRequest.endpoint),
      quoted_credits: input.quotedCredits,
      credit_reservation_key: input.reservationKey,
      character_asset_id: input.characterAssetId,
      metadata: input.metadata,
    })
    .select("id")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create image generation.")
  }

  return { generationId: data.id, predictionId: requestId }
}