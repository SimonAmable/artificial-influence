import { fal } from "@fal-ai/client"
import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import { checkUserHasCredits, deductUserCredits } from "@/lib/credits"
import { syncGenerationResultToPersistedChat } from "@/lib/chat/media-persistence"
import { configureFal } from "./fal-image"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

function getExtensionForMimeType(mimeType: string, fallback: string) {
  const normalized = mimeType.toLowerCase()
  if (normalized === "video/webm") return "webm"
  if (normalized === "video/quicktime") return "mov"
  if (normalized === "video/mp4") return "mp4"
  return fallback
}

type PendingFalVideoRow = {
  id: string
  user_id: string
  model: string
  prompt: string | null
  tool?: string | null
  reference_images_supabase_storage_path?: string[] | null
  reference_videos_supabase_storage_path?: string[] | null
  chat_message_id?: string | null
  chat_thread_id?: string | null
  chat_tool_call_id?: string | null
  replicate_prediction_id: string | null
  fal_endpoint_id: string | null
}

export async function tryCompleteFalPendingVideo(
  supabaseUser: SupabaseClient,
  userId: string,
  predictionId: string,
): Promise<{ status: "pending" | "completed" | "failed"; error?: string }> {
  const { data: generation, error } = await supabaseUser
    .from("generations")
    .select(
      "id, user_id, model, prompt, tool, reference_images_supabase_storage_path, reference_videos_supabase_storage_path, chat_message_id, chat_thread_id, chat_tool_call_id, status, replicate_prediction_id, fal_endpoint_id, type",
    )
    .eq("replicate_prediction_id", predictionId)
    .eq("user_id", userId)
    .eq("type", "video")
    .maybeSingle()

  if (error || !generation) {
    return { status: "pending" }
  }

  const row = generation as PendingFalVideoRow & { status: string; type: string }
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
    console.error("[fal-video-completion] queue.status", e)
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
    const msg = e instanceof Error ? e.message : "Fal result error"
    await supabaseAdmin
      .from("generations")
      .update({ status: "failed", error_message: msg, finished_at: new Date().toISOString() })
      .eq("id", row.id)
    await syncGenerationResultToPersistedChat({ predictionId, supabase: supabaseAdmin })
    return { status: "failed", error: msg }
  }

  const data = result.data as { video?: { url?: string } }
  const outputUrl = typeof data?.video?.url === "string" ? data.video.url : null

  if (!outputUrl) {
    await supabaseAdmin
      .from("generations")
      .update({
        status: "failed",
        error_message: "Fal returned no video URL",
        finished_at: new Date().toISOString(),
      })
      .eq("id", row.id)
    await syncGenerationResultToPersistedChat({ predictionId, supabase: supabaseAdmin })
    return { status: "failed", error: "No video URL" }
  }

  const modelRow = await supabaseAdmin
    .from("models")
    .select("model_cost")
    .eq("identifier", row.model)
    .eq("type", "video")
    .single()

  const requiredCredits = Math.max(
    1,
    Number((modelRow.data as { model_cost?: number } | null)?.model_cost ?? 20) || 20,
  )
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
    response.headers.get("content-type")?.split(";")[0]?.trim() || "video/mp4"
  const extension = getExtensionForMimeType(contentType, "mp4")
  const filename = `${Date.now()}-${Math.random().toString(36).slice(7)}.${extension}`
  const storagePath = `${row.user_id}/video-generations/${filename}`

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

  await supabaseAdmin
    .from("generations")
    .update({
      supabase_storage_path: storagePath,
      status: "completed",
      error_message: null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", row.id)

  await syncGenerationResultToPersistedChat({ predictionId, supabase: supabaseAdmin })
  await deductUserCredits(row.user_id, requiredCredits, supabaseAdmin)

  return { status: "completed" }
}
