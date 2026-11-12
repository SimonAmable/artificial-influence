import { createClient } from "@supabase/supabase-js"
import { deductUserCreditsUpTo } from "@/lib/credits"
import { syncGenerationResultToPersistedChat } from "@/lib/chat/media-persistence"
import { notifyGenerationCompleteTelegram } from "@/lib/server/notify-generation-complete"
import { parseWaveSpeedEndpoint } from "@/lib/server/wavespeed-wan30-request"

export {
  buildWan30WaveSpeedRequest,
  parseWaveSpeedEndpoint,
  WAVESPEED_ENDPOINT_PREFIX,
  wavespeedStoredEndpoint,
} from "@/lib/server/wavespeed-wan30-request"
export type { Wan30WaveSpeedRequestOptions } from "@/lib/server/wavespeed-wan30-request"

const WAVESPEED_API_BASE = "https://api.wavespeed.ai/api/v3"
const TERMINAL_FAILURE = new Set(["failed", "cancelled", "timeout", "deleted"])

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

type WaveSpeedTask = {
  id?: string
  status?: string
  outputs?: unknown
  error?: string
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function extensionForMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase()
  if (normalized === "video/webm") return "webm"
  if (normalized === "video/quicktime") return "mov"
  return "mp4"
}

function waveSpeedApiKey(): string {
  const apiKey = process.env.WAVESPEED_API_KEY
  if (!apiKey) throw new Error("WAVESPEED_API_KEY is not configured.")
  return apiKey
}

async function waveSpeedJson(url: string, init?: RequestInit): Promise<WaveSpeedTask> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${waveSpeedApiKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  const body = (await response.json().catch(() => null)) as { data?: WaveSpeedTask; message?: string } | WaveSpeedTask | null
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : `WaveSpeed request failed (${response.status})`
    throw new Error(message)
  }
  if (body && typeof body === "object" && "data" in body && body.data && typeof body.data === "object") {
    return body.data
  }
  return (body ?? {}) as WaveSpeedTask
}

export async function submitWaveSpeedPrediction(
  endpoint: string,
  input: Record<string, unknown>,
): Promise<string> {
  const task = await waveSpeedJson(`${WAVESPEED_API_BASE}/${endpoint}`, {
    method: "POST",
    body: JSON.stringify(input),
  })
  if (!task.id) throw new Error("WaveSpeed did not return a prediction id.")
  return task.id
}

function firstOutputUrl(outputs: unknown): string | null {
  if (!Array.isArray(outputs)) return null
  for (const item of outputs) {
    if (typeof item === "string" && item.trim()) return item.trim()
    if (item && typeof item === "object" && "url" in item && typeof item.url === "string" && item.url.trim()) {
      return item.url.trim()
    }
  }
  return null
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

export async function completeWaveSpeedPendingVideoAdmin(
  predictionId: string,
): Promise<{ status: "pending" | "completed" | "failed"; error?: string }> {
  const { data: generation, error } = await supabaseAdmin
    .from("generations")
    .select(
      "id, user_id, model, prompt, quoted_credits, status, replicate_prediction_id, fal_endpoint_id, type",
    )
    .eq("replicate_prediction_id", predictionId)
    .eq("type", "video")
    .maybeSingle()

  if (error || !generation) return { status: "pending" }
  const row = generation as {
    id: string
    user_id: string
    status: string
    quoted_credits?: number | null
    model: string
    replicate_prediction_id: string | null
    fal_endpoint_id: string | null
  }
  if (!parseWaveSpeedEndpoint(row.fal_endpoint_id)) {
    return { status: row.status === "completed" ? "completed" : row.status === "failed" ? "failed" : "pending" }
  }
  if (row.status !== "pending" || !row.replicate_prediction_id) {
    return { status: row.status === "completed" ? "completed" : row.status === "failed" ? "failed" : "pending" }
  }

  let task: WaveSpeedTask
  try {
    task = await waveSpeedJson(`${WAVESPEED_API_BASE}/predictions/${row.replicate_prediction_id}/result`)
  } catch (pollError) {
    console.error("[wavespeed-video] poll", pollError)
    return { status: "pending" }
  }

  const status = task.status ?? ""
  if (!status || status === "created" || status === "processing" || status === "pending" || status === "queued") {
    return { status: "pending" }
  }
  if (TERMINAL_FAILURE.has(status)) {
    const message = text(task.error) ?? `WaveSpeed status: ${status}`
    await markFailed(row.id, predictionId, message)
    return { status: "failed", error: message }
  }
  if (status !== "completed") return { status: "pending" }

  const outputUrl = firstOutputUrl(task.outputs)
  if (!outputUrl) {
    await markFailed(row.id, predictionId, "WaveSpeed returned no video URL")
    return { status: "failed", error: "No video URL" }
  }

  const response = await fetch(outputUrl)
  if (!response.ok) {
    await markFailed(row.id, predictionId, `Failed to download WaveSpeed output (${response.status})`)
    return { status: "failed", error: "Download failed" }
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "video/mp4"
  const filename = `${Date.now()}-${Math.random().toString(36).slice(7)}.${extensionForMime(contentType)}`
  const storagePath = `${row.user_id}/video-generations/${filename}`
  const { error: uploadError } = await supabaseAdmin.storage.from("public-bucket").upload(storagePath, buffer, {
    contentType,
    upsert: false,
  })
  if (uploadError) {
    await markFailed(row.id, predictionId, uploadError.message)
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

  const modelRow = await supabaseAdmin
    .from("models")
    .select("model_cost")
    .eq("identifier", row.model)
    .eq("provider", "wavespeed")
    .eq("type", "video")
    .maybeSingle()
  const requiredCredits = Math.max(
    1,
    Number((row.quoted_credits ?? (modelRow.data as { model_cost?: number } | null)?.model_cost ?? 8)) || 8,
  )
  await deductUserCreditsUpTo(row.user_id, requiredCredits, supabaseAdmin)
  void notifyGenerationCompleteTelegram(supabaseAdmin, {
    userId: row.user_id,
    generationId: row.id,
  })
  return { status: "completed" }
}
