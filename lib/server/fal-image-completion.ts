import { fal } from "@fal-ai/client"
import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import { checkUserHasCredits, deductUserCredits } from "@/lib/credits"
import { syncGenerationResultToPersistedChat } from "@/lib/chat/media-persistence"
import { configureFal } from "./fal-image"
import { formatFalClientError } from "./fal-client-error"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

function getExtensionForMimeType(mimeType: string, fallback: string) {
  const normalized = mimeType.toLowerCase()
  if (normalized === "image/jpeg") return "jpg"
  if (normalized === "image/png") return "png"
  if (normalized === "image/webp") return "webp"
  return fallback
}

type PendingFalImageRow = {
  id: string
  user_id: string
  model: string
  prompt: string | null
  aspect_ratio?: string | null
  tool?: string | null
  reference_images_supabase_storage_path?: string[] | null
  chat_message_id?: string | null
  chat_thread_id?: string | null
  chat_tool_call_id?: string | null
  replicate_prediction_id: string | null
  fal_endpoint_id: string | null
}

/**
 * If the row is a pending Fal image job, poll Fal once; when complete, persist to storage and deduct credits.
 * Returns updated status: pending | completed | failed.
 */
export async function tryCompleteFalPendingImage(
  supabaseUser: SupabaseClient,
  userId: string,
  predictionId: string,
): Promise<{ status: "pending" | "completed" | "failed"; error?: string }> {
  const { data: generation, error } = await supabaseUser
    .from("generations")
    .select(
      "id, user_id, model, prompt, aspect_ratio, tool, reference_images_supabase_storage_path, chat_message_id, chat_thread_id, chat_tool_call_id, status, replicate_prediction_id, fal_endpoint_id, type",
    )
    .eq("replicate_prediction_id", predictionId)
    .eq("user_id", userId)
    .eq("type", "image")
    .maybeSingle()

  if (error || !generation) {
    return { status: "pending" }
  }

  const row = generation as PendingFalImageRow & { status: string; type: string }
  if (row.status !== "pending" || !row.fal_endpoint_id || !row.replicate_prediction_id) {
    return { status: "pending" }
  }

  configureFal()
  const endpointId = row.fal_endpoint_id
  const requestId = row.replicate_prediction_id

  let queueStatus
  try {
    queueStatus = await fal.queue.status(endpointId, { requestId })
  } catch (e) {
    console.error("[fal-image-completion] queue.status", e)
    return { status: "pending" }
  }

  if (queueStatus.status === "IN_QUEUE" || queueStatus.status === "IN_PROGRESS") {
    return { status: "pending" }
  }

  if (queueStatus.status !== "COMPLETED") {
    await supabaseAdmin
      .from("generations")
      .update({
        status: "failed",
        error_message: `Fal queue status: ${queueStatus.status}`,
        finished_at: new Date().toISOString(),
      })
      .eq("id", row.id)
    await syncGenerationResultToPersistedChat({ predictionId, supabase: supabaseAdmin })
    return { status: "failed", error: "Fal generation failed" }
  }

  let result
  try {
    result = await fal.queue.result(endpointId, { requestId })
  } catch (e) {
    const msg = formatFalClientError(e)
    await supabaseAdmin
      .from("generations")
      .update({ status: "failed", error_message: msg, finished_at: new Date().toISOString() })
      .eq("id", row.id)
    await syncGenerationResultToPersistedChat({ predictionId, supabase: supabaseAdmin })
    return { status: "failed", error: msg }
  }

  const data = result.data as { images?: Array<{ url?: string }> }
  const urls = (data?.images ?? [])
    .map((im) => (typeof im?.url === "string" ? im.url : null))
    .filter((u): u is string => Boolean(u))

  if (urls.length === 0) {
    await supabaseAdmin
      .from("generations")
      .update({
        status: "failed",
        error_message: "Fal returned no image URLs",
        finished_at: new Date().toISOString(),
      })
      .eq("id", row.id)
    await syncGenerationResultToPersistedChat({ predictionId, supabase: supabaseAdmin })
    return { status: "failed", error: "No image URLs" }
  }

  const modelRow = await supabaseAdmin
    .from("models")
    .select("model_cost")
    .eq("identifier", row.model)
    .eq("type", "image")
    .single()

  const costPerOutput = Math.max(1, Number((modelRow.data as { model_cost?: number } | null)?.model_cost ?? 2) || 2)
  const requiredCredits = costPerOutput * urls.length

  const hasCredits = await checkUserHasCredits(row.user_id, requiredCredits, supabaseAdmin)
  if (!hasCredits) {
    await supabaseAdmin
      .from("generations")
      .update({
        status: "failed",
        error_message: "Insufficient credits when processing Fal result",
        finished_at: new Date().toISOString(),
      })
      .eq("id", row.id)
    await syncGenerationResultToPersistedChat({ predictionId, supabase: supabaseAdmin })
    return { status: "failed", error: "Insufficient credits" }
  }

  const persistedOutputs: { storagePath: string; url: string }[] = []

  for (let index = 0; index < urls.length; index++) {
    const outputUrl = urls[index]
    const response = await fetch(outputUrl)
    if (!response.ok) {
      await supabaseAdmin
        .from("generations")
        .update({
          status: "failed",
          error_message: `Failed to download Fal output (${response.status})`,
          finished_at: new Date().toISOString(),
        })
        .eq("id", row.id)
      await syncGenerationResultToPersistedChat({ predictionId, supabase: supabaseAdmin })
      return { status: "failed", error: "Download failed" }
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png"
    const extension = getExtensionForMimeType(contentType, "png")
    const filename =
      urls.length > 1
        ? `${Date.now()}-${Math.random().toString(36).slice(7)}-${index}.${extension}`
        : `${Date.now()}-${Math.random().toString(36).slice(7)}.${extension}`
    const storagePath = `${row.user_id}/image-generations/${filename}`

    const { error: uploadError } = await supabaseAdmin.storage.from("public-bucket").upload(storagePath, buffer, {
      contentType,
      upsert: false,
    })

    if (uploadError) {
      await supabaseAdmin
        .from("generations")
        .update({
          status: "failed",
          error_message: uploadError.message,
          finished_at: new Date().toISOString(),
        })
        .eq("id", row.id)
      await syncGenerationResultToPersistedChat({ predictionId, supabase: supabaseAdmin })
      return { status: "failed", error: "Upload failed" }
    }

    const { data: urlData } = supabaseAdmin.storage.from("public-bucket").getPublicUrl(storagePath)
    persistedOutputs.push({ storagePath, url: urlData.publicUrl })
  }

  const completedAt = new Date().toISOString()
  await supabaseAdmin
    .from("generations")
    .update({
      supabase_storage_path: persistedOutputs[0]?.storagePath ?? null,
      status: "completed",
      error_message: null,
      finished_at: completedAt,
    })
    .eq("id", row.id)

  const referenceImagePaths = row.reference_images_supabase_storage_path ?? []
  if (persistedOutputs.length > 1) {
    const extraRows = persistedOutputs.slice(1).map((persistedOutput) => ({
      user_id: row.user_id,
      prompt: row.prompt,
      supabase_storage_path: persistedOutput.storagePath,
      reference_images_supabase_storage_path: referenceImagePaths.length > 0 ? referenceImagePaths : null,
      aspect_ratio: row.aspect_ratio ?? null,
      chat_message_id: row.chat_message_id ?? null,
      chat_thread_id: row.chat_thread_id ?? null,
      chat_tool_call_id: row.chat_tool_call_id ?? null,
      model: row.model,
      type: "image",
      is_public: true,
      tool: row.tool ?? null,
      status: "completed",
      replicate_prediction_id: predictionId,
      finished_at: completedAt,
    }))
    await supabaseAdmin.from("generations").insert(extraRows)
  }

  await syncGenerationResultToPersistedChat({ predictionId, supabase: supabaseAdmin })
  await deductUserCredits(row.user_id, requiredCredits, supabaseAdmin)

  return { status: "completed" }
}
