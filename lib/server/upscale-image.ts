import Replicate from "replicate"
import type { SupabaseClient } from "@supabase/supabase-js"
import { checkUserHasCredits, deductUserCredits } from "@/lib/credits"

/** Pinned Replicate version — https://replicate.com/prunaai/p-image-upscale */
export const UPSCALE_REPLICATE_MODEL_ID =
  "prunaai/p-image-upscale:ea74e255330ec5a0a6aa394e7e1451a8cea94fe1edb8266cc4848eab047a74c4"

export const UPSCALE_MODEL_IDENTIFIER = "prunaai/p-image-upscale"

export const DEFAULT_UPSCALE_CREDITS_COST = 1

export const DEFAULT_UPSCALE_REPLICATE_INPUT: Record<string, unknown> = {
  upscale_mode: "target",
  target: 4,
  enhance_realism: true,
  output_format: "png",
  disable_safety_checker: true,
}

export type UpscaleMode = "target" | "factor"

export type UpscaleParameters = {
  upscale_mode?: UpscaleMode
  target?: number
  factor?: number
  enhance_realism?: boolean
  enhance_details?: boolean
  output_format?: "jpg" | "png" | "webp"
}

export function extractUpscaleOutputUrl(output: unknown): string | null {
  if (typeof output === "string" && (output.startsWith("http://") || output.startsWith("https://"))) {
    return output
  }
  if (output && typeof output === "object") {
    const obj = output as { url?: string | (() => string) }
    if (typeof obj.url === "function") return obj.url()
    if (typeof obj.url === "string") return obj.url
  }
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0]
    return typeof first === "string" ? first : extractUpscaleOutputUrl(first)
  }
  return null
}

export async function findActiveUpscaleModelRow(supabase: SupabaseClient) {
  const { data: pinned, error: pinnedError } = await supabase
    .from("models")
    .select("id, name, model_cost, identifier")
    .eq("identifier", UPSCALE_REPLICATE_MODEL_ID)
    .eq("is_active", true)
    .maybeSingle()

  if (!pinnedError && pinned) return pinned

  const { data: fallback, error: fallbackError } = await supabase
    .from("models")
    .select("id, name, model_cost, identifier")
    .eq("identifier", UPSCALE_MODEL_IDENTIFIER)
    .eq("type", "upscale")
    .eq("is_active", true)
    .maybeSingle()

  if (!fallbackError && fallback) return fallback

  return null
}

function buildReplicateUpscaleInput(
  imageUrl: string,
  parameters: UpscaleParameters,
): Record<string, unknown> {
  return {
    ...DEFAULT_UPSCALE_REPLICATE_INPUT,
    image: imageUrl,
    ...(parameters.upscale_mode ? { upscale_mode: parameters.upscale_mode } : {}),
    ...(parameters.target != null ? { target: parameters.target } : {}),
    ...(parameters.factor != null ? { factor: parameters.factor } : {}),
    ...(parameters.enhance_realism != null ? { enhance_realism: parameters.enhance_realism } : {}),
    ...(parameters.enhance_details != null ? { enhance_details: parameters.enhance_details } : {}),
    ...(parameters.output_format ? { output_format: parameters.output_format } : {}),
    disable_safety_checker: true,
  }
}

export type RunImageUpscaleOptions = {
  supabase: SupabaseClient
  userId: string
  imageUrl: string
  parameters?: UpscaleParameters
  threadId?: string
  tool?: string
  referenceImageStoragePaths?: string[] | null
}

export type RunImageUpscaleResult = {
  creditsUsed: number
  generationId: string | null
  imageUrl: string
  modelIdentifier: string
  storagePath: string | null
}

export async function runImageUpscale({
  supabase,
  userId,
  imageUrl,
  parameters = {},
  threadId,
  tool = "upscale",
  referenceImageStoragePaths = null,
}: RunImageUpscaleOptions): Promise<RunImageUpscaleResult> {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN environment variable is not set.")
  }

  const trimmedUrl = imageUrl.trim()
  if (!trimmedUrl) {
    throw new Error("Upscale requires a source image URL.")
  }

  const modelRow = await findActiveUpscaleModelRow(supabase)
  const creditsCost = Math.max(
    1,
    Number(modelRow?.model_cost ?? DEFAULT_UPSCALE_CREDITS_COST) || DEFAULT_UPSCALE_CREDITS_COST,
  )
  const modelIdentifier =
    typeof modelRow?.identifier === "string" && modelRow.identifier.length > 0
      ? modelRow.identifier
      : UPSCALE_MODEL_IDENTIFIER

  const hasCredits = await checkUserHasCredits(userId, creditsCost, supabase)
  if (!hasCredits) {
    throw new Error(`Insufficient credits. Upscale requires ${creditsCost} credit${creditsCost === 1 ? "" : "s"}.`)
  }

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
  const replicateInput = buildReplicateUpscaleInput(trimmedUrl, parameters)

  const output = await replicate.run(UPSCALE_REPLICATE_MODEL_ID as `${string}/${string}`, {
    input: replicateInput,
  })

  const outputUrl = extractUpscaleOutputUrl(output)
  if (!outputUrl) {
    throw new Error("Unexpected output from upscale model.")
  }

  let savedUrl = outputUrl
  let savedStoragePath: string | null = null
  let generationId: string | null = null

  try {
    const imageRes = await fetch(outputUrl)
    if (imageRes.ok) {
      const buffer = Buffer.from(await imageRes.arrayBuffer())
      const timestamp = Date.now()
      const storagePath = `${userId}/upscale-outputs/${timestamp}.png`
      const { error: saveError } = await supabase.storage
        .from("public-bucket")
        .upload(storagePath, buffer, {
          contentType: "image/png",
          upsert: false,
        })

      if (!saveError) {
        savedStoragePath = storagePath
        const { data: savedData } = supabase.storage.from("public-bucket").getPublicUrl(storagePath)
        savedUrl = savedData.publicUrl
      }
    }
  } catch (saveErr) {
    console.warn("[upscale] Save to storage failed, returning Replicate URL:", saveErr)
  }

  if (savedStoragePath) {
    const { data: generationRow, error: genError } = await supabase
      .from("generations")
      .insert({
        user_id: userId,
        prompt: null,
        supabase_storage_path: savedStoragePath,
        reference_images_supabase_storage_path:
          referenceImageStoragePaths && referenceImageStoragePaths.length > 0
            ? referenceImageStoragePaths
            : null,
        model: modelIdentifier,
        type: "image",
        is_public: true,
        tool,
        status: "completed",
        error_message: null,
        ...(threadId ? { chat_thread_id: threadId } : {}),
      })
      .select("id")
      .single()

    if (genError) {
      console.warn("[upscale] Failed to save to generations table:", genError)
    } else if (generationRow?.id) {
      generationId = generationRow.id
    }
  }

  await deductUserCredits(userId, creditsCost, supabase)

  return {
    creditsUsed: creditsCost,
    generationId,
    imageUrl: savedUrl,
    modelIdentifier,
    storagePath: savedStoragePath,
  }
}
