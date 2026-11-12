import { createClient } from "@supabase/supabase-js"
import { checkUserHasCredits, deductUserCredits } from "@/lib/credits"
import { syncGenerationResultToPersistedChat } from "@/lib/chat/media-persistence"
import { getAutoStripImageMetadata } from "@/lib/server/auto-strip-image-metadata"
import { notifyGenerationCompleteTelegram } from "@/lib/server/notify-generation-complete"
import { prepareGeneratedImageForStorage } from "@/lib/server/prepare-generated-image-for-storage"
import { parseWaveSpeedEndpoint } from "@/lib/server/wavespeed-wan30-request"
import { fetchWaveSpeedPrediction } from "@/lib/server/wavespeed-video"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const PENDING_STATUS = new Set(["", "created", "processing", "pending", "queued"])
const TERMINAL_FAILURE = new Set(["failed", "cancelled", "timeout", "deleted"])

type PendingWaveSpeedImageRow = {
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
  status: string
  quoted_credits?: number | null
  character_asset_id?: string | null
}

function extensionForMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase()
  if (normalized === "image/jpeg") return "jpg"
  if (normalized === "image/webp") return "webp"
  return "png"
}

function outputUrls(outputs: unknown): string[] {
  if (!Array.isArray(outputs)) return []
  const urls: string[] = []
  for (const item of outputs) {
    if (typeof item === "string" && item.trim()) urls.push(item.trim())
    else if (item && typeof item === "object" && "url" in item && typeof item.url === "string" && item.url.trim()) {
      urls.push(item.url.trim())
    }
  }
  return urls
}

async function markFailed(generationId: string, predictionId: string, message: string) {
  await supabaseAdmin
    .from("generations")
    .update({
      status: "failed",
      error_message: message,
      finished_at: new Date().toISOString(),
    })
    .eq("id", generationId)
  await syncGenerationResultToPersistedChat({ predictionId, supabase: supabaseAdmin })
}

export async function completeWaveSpeedPendingImageAdmin(
  predictionId: string,
): Promise<{ status: "pending" | "completed" | "failed"; error?: string }> {
  const { data: generation, error } = await supabaseAdmin
    .from("generations")
    .select(
      "id, user_id, model, prompt, aspect_ratio, tool, reference_images_supabase_storage_path, character_asset_id, chat_message_id, chat_thread_id, chat_tool_call_id, status, replicate_prediction_id, fal_endpoint_id, type, quoted_credits",
    )
    .eq("replicate_prediction_id", predictionId)
    .eq("type", "image")
    .maybeSingle()

  if (error || !generation) return { status: "pending" }
  const row = generation as PendingWaveSpeedImageRow
  if (!parseWaveSpeedEndpoint(row.fal_endpoint_id)) {
    return { status: row.status === "completed" ? "completed" : row.status === "failed" ? "failed" : "pending" }
  }
  if (row.status !== "pending" || !row.replicate_prediction_id) {
    return { status: row.status === "completed" ? "completed" : row.status === "failed" ? "failed" : "pending" }
  }

  let task: Awaited<ReturnType<typeof fetchWaveSpeedPrediction>>
  try {
    task = await fetchWaveSpeedPrediction(row.replicate_prediction_id)
  } catch (pollError) {
    console.error("[wavespeed-image] poll", pollError)
    return { status: "pending" }
  }

  const status = task.status.toLowerCase()
  if (PENDING_STATUS.has(status)) return { status: "pending" }
  if (TERMINAL_FAILURE.has(status)) {
    const message = task.error ?? `WaveSpeed status: ${status}`
    await markFailed(row.id, predictionId, message)
    return { status: "failed", error: message }
  }
  if (status !== "completed") return { status: "pending" }

  const urls = outputUrls(task.outputs)
  if (urls.length === 0) {
    await markFailed(row.id, predictionId, "WaveSpeed returned no image URL")
    return { status: "failed", error: "No image URL" }
  }

  const modelRow = await supabaseAdmin
    .from("models")
    .select("model_cost")
    .eq("identifier", row.model)
    .eq("type", "image")
    .eq("provider", "wavespeed")
    .order("is_active", { ascending: false })
    .limit(1)
    .maybeSingle()
  const costPerOutput = Math.max(1, Number((modelRow.data as { model_cost?: number } | null)?.model_cost ?? 4) || 4)
  const requiredCredits = Math.max(
    1,
    Number(row.quoted_credits ?? costPerOutput * urls.length) || costPerOutput * urls.length,
  )
  const hasCredits = await checkUserHasCredits(row.user_id, requiredCredits, supabaseAdmin)
  if (!hasCredits) {
    await markFailed(row.id, predictionId, "Insufficient credits when processing WaveSpeed result")
    return { status: "failed", error: "Insufficient credits" }
  }

  const persistedOutputs: { storagePath: string }[] = []
  const autoStrip = await getAutoStripImageMetadata(supabaseAdmin, row.user_id)
  for (let index = 0; index < urls.length; index++) {
    const outputUrl = urls[index]
    const response = await fetch(outputUrl)
    if (!response.ok) {
      await markFailed(row.id, predictionId, `Failed to download WaveSpeed output (${response.status})`)
      return { status: "failed", error: "Download failed" }
    }
    const downloadedMimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png"
    const prepared = await prepareGeneratedImageForStorage({
      autoStrip,
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType: downloadedMimeType,
      modelIdentifier: row.model,
      remoteUrl: outputUrl,
    })
    const extension = extensionForMime(prepared.mimeType)
    const filename =
      urls.length > 1
        ? `${Date.now()}-${Math.random().toString(36).slice(7)}-${index}.${extension}`
        : `${Date.now()}-${Math.random().toString(36).slice(7)}.${extension}`
    const storagePath = `${row.user_id}/image-generations/${filename}`
    const { error: uploadError } = await supabaseAdmin.storage.from("public-bucket").upload(storagePath, prepared.buffer, {
      contentType: prepared.mimeType,
      upsert: false,
    })
    if (uploadError) {
      await markFailed(row.id, predictionId, uploadError.message)
      return { status: "failed", error: "Upload failed" }
    }
    persistedOutputs.push({ storagePath })
  }

  const completedAt = new Date().toISOString()
  await supabaseAdmin
    .from("generations")
    .update({
      supabase_storage_path: persistedOutputs[0]?.storagePath ?? null,
      status: "completed",
      error_message: null,
      finished_at: completedAt,
      character_asset_id: row.character_asset_id ?? null,
    })
    .eq("id", row.id)

  const referenceImagePaths = row.reference_images_supabase_storage_path ?? []
  if (persistedOutputs.length > 1) {
    await supabaseAdmin.from("generations").insert(
      persistedOutputs.slice(1).map((persistedOutput) => ({
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
        character_asset_id: row.character_asset_id ?? null,
      })),
    )
  }

  await syncGenerationResultToPersistedChat({ predictionId, supabase: supabaseAdmin })
  await deductUserCredits(row.user_id, requiredCredits, supabaseAdmin)
  void notifyGenerationCompleteTelegram(supabaseAdmin, {
    userId: row.user_id,
    generationId: row.id,
  })
  return { status: "completed" }
}
