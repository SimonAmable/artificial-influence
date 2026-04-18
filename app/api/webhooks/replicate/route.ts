import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { checkUserHasCredits, deductUserCredits } from "@/lib/credits"
import { syncGenerationResultToPersistedChat } from "@/lib/chat/media-persistence"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

type ReplicatePrediction = {
  error?: string | null
  id: string
  output?: unknown
  status: string
}

type PendingGenerationRow = {
  aspect_ratio?: string | null
  chat_message_id?: string | null
  chat_thread_id?: string | null
  chat_tool_call_id?: string | null
  id: string
  model: string
  prompt: string | null
  reference_images_supabase_storage_path?: string[] | null
  reference_videos_supabase_storage_path?: string[] | null
  tool?: string | null
  type: "image" | "video"
  user_id: string
}

function extractOutputUrls(output: unknown): string[] {
  const urls: string[] = []

  const extract = (value: unknown) => {
    if (typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://"))) {
      urls.push(value)
      return
    }

    if (value && typeof value === "object") {
      const obj = value as { url?: string | (() => string) }
      if (typeof obj.url === "function") {
        const resolvedUrl = obj.url()
        if (resolvedUrl && (resolvedUrl.startsWith("http://") || resolvedUrl.startsWith("https://"))) {
          urls.push(resolvedUrl)
        }
        return
      }

      if (typeof obj.url === "string") {
        urls.push(obj.url)
      }
    }
  }

  if (Array.isArray(output)) {
    output.forEach(extract)
  } else {
    extract(output)
  }

  return urls
}

function getExtensionForMimeType(mimeType: string, fallback: string) {
  const normalized = mimeType.toLowerCase()

  if (normalized === "image/jpeg") return "jpg"
  if (normalized === "image/png") return "png"
  if (normalized === "image/webp") return "webp"
  if (normalized === "video/webm") return "webm"
  if (normalized === "video/quicktime") return "mov"
  if (normalized === "video/mp4") return "mp4"

  return fallback
}

function getDefaultMimeTypeForGeneration(type: PendingGenerationRow["type"]) {
  return type === "video" ? "video/mp4" : "image/png"
}

function getGenerationFolder(type: PendingGenerationRow["type"]) {
  return type === "video" ? "video-generations" : "image-generations"
}

async function uploadReplicateOutput(
  generation: PendingGenerationRow,
  outputUrl: string,
  index?: number,
): Promise<{ storagePath: string; url: string }> {
  const response = await fetch(outputUrl)
  if (!response.ok) {
    throw new Error(`Failed to download Replicate output (${response.status})`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType =
    response.headers.get("content-type")?.split(";")[0]?.trim() || getDefaultMimeTypeForGeneration(generation.type)
  const extension = getExtensionForMimeType(
    contentType,
    generation.type === "video" ? "mp4" : "png",
  )
  const filename =
    index !== undefined
      ? `${Date.now()}-${Math.random().toString(36).slice(7)}-${index}.${extension}`
      : `${Date.now()}-${Math.random().toString(36).slice(7)}.${extension}`
  const storagePath = `${generation.user_id}/${getGenerationFolder(generation.type)}/${filename}`

  const { error: uploadError } = await supabaseAdmin.storage.from("public-bucket").upload(storagePath, buffer, {
    contentType,
    upsert: false,
  })

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  const { data: urlData } = supabaseAdmin.storage.from("public-bucket").getPublicUrl(storagePath)
  return {
    storagePath,
    url: urlData.publicUrl,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReplicatePrediction
    const { id: predictionId, status, output, error } = body

    if (!predictionId || !status) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const terminalStatuses = ["succeeded", "failed", "canceled"]
    if (!terminalStatuses.includes(status)) {
      return NextResponse.json({ received: true })
    }

    const { data: generation, error: fetchError } = await supabaseAdmin
      .from("generations")
      .select(
        "id, user_id, prompt, model, reference_images_supabase_storage_path, reference_videos_supabase_storage_path, aspect_ratio, tool, type, chat_thread_id, chat_message_id, chat_tool_call_id",
      )
      .eq("replicate_prediction_id", predictionId)
      .eq("status", "pending")
      .maybeSingle()

    if (fetchError || !generation) {
      console.warn("[webhooks/replicate] No pending generation for prediction:", predictionId, fetchError?.message)
      return NextResponse.json({ received: true })
    }

    const pendingGeneration = generation as PendingGenerationRow
    const finishedAt = new Date().toISOString()

    if (status !== "succeeded" || output == null) {
      await supabaseAdmin
        .from("generations")
        .update({
          status: "failed",
          error_message: error || `Prediction ${status}`,
          finished_at: finishedAt,
        })
        .eq("id", pendingGeneration.id)
      await syncGenerationResultToPersistedChat({
        predictionId,
        supabase: supabaseAdmin,
      })
      console.log("[webhooks/replicate] Marked prediction as failed", predictionId, error)
      return NextResponse.json({ received: true })
    }

    const outputUrls = extractOutputUrls(output)
    if (outputUrls.length === 0) {
      await supabaseAdmin
        .from("generations")
        .update({
          status: "failed",
          error_message: "Replicate returned no output URLs",
          finished_at: finishedAt,
        })
        .eq("id", pendingGeneration.id)
      await syncGenerationResultToPersistedChat({
        predictionId,
        supabase: supabaseAdmin,
      })
      return NextResponse.json({ received: true })
    }

    const urlsToPersist =
      pendingGeneration.type === "video"
        ? outputUrls.slice(0, 1)
        : outputUrls

    const persistedOutputs = await Promise.all(
      urlsToPersist.map((url, index) =>
        uploadReplicateOutput(
          pendingGeneration,
          url,
          pendingGeneration.type === "image" && urlsToPersist.length > 1 ? index : undefined,
        ),
      ),
    )

    const modelRow = await supabaseAdmin
      .from("models")
      .select("model_cost")
      .eq("identifier", pendingGeneration.model)
      .eq("type", pendingGeneration.type)
      .single()

    const defaultCost = pendingGeneration.type === "video" ? 10 : 2
    const costPerOutput = Math.max(
      1,
      Number((modelRow.data as { model_cost?: number } | null)?.model_cost ?? defaultCost) || defaultCost,
    )
    const requiredCredits =
      pendingGeneration.type === "image"
        ? costPerOutput * persistedOutputs.length
        : costPerOutput

    const hasCredits = await checkUserHasCredits(pendingGeneration.user_id, requiredCredits, supabaseAdmin)
    if (!hasCredits) {
      await supabaseAdmin
        .from("generations")
        .update({
          status: "failed",
          error_message: "Insufficient credits when processing result",
          finished_at: finishedAt,
        })
        .eq("id", pendingGeneration.id)
      await syncGenerationResultToPersistedChat({
        predictionId,
        supabase: supabaseAdmin,
      })
      return NextResponse.json({ received: true })
    }

    await supabaseAdmin
      .from("generations")
      .update({
        supabase_storage_path: persistedOutputs[0]?.storagePath ?? null,
        status: "completed",
        error_message: null,
        finished_at: finishedAt,
      })
      .eq("id", pendingGeneration.id)

    if (pendingGeneration.type === "image") {
      const referenceImagePaths = pendingGeneration.reference_images_supabase_storage_path ?? []
      const extraRows = persistedOutputs.slice(1).map((persistedOutput) => ({
        user_id: pendingGeneration.user_id,
        prompt: pendingGeneration.prompt,
        supabase_storage_path: persistedOutput.storagePath,
        reference_images_supabase_storage_path: referenceImagePaths.length > 0 ? referenceImagePaths : null,
        aspect_ratio: pendingGeneration.aspect_ratio ?? null,
        chat_message_id: pendingGeneration.chat_message_id ?? null,
        chat_thread_id: pendingGeneration.chat_thread_id ?? null,
        chat_tool_call_id: pendingGeneration.chat_tool_call_id ?? null,
        model: pendingGeneration.model,
        type: "image",
        is_public: true,
        tool: pendingGeneration.tool ?? null,
        status: "completed",
        replicate_prediction_id: predictionId,
        finished_at: finishedAt,
      }))

      if (extraRows.length > 0) {
        await supabaseAdmin.from("generations").insert(extraRows)
      }
    }

    await syncGenerationResultToPersistedChat({
      predictionId,
      supabase: supabaseAdmin,
    })

    await deductUserCredits(pendingGeneration.user_id, requiredCredits, supabaseAdmin)
    console.log(
      "[webhooks/replicate] Completed prediction",
      predictionId,
      "generation",
      pendingGeneration.id,
      "type",
      pendingGeneration.type,
    )

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("[webhooks/replicate] Error:", error)
    return NextResponse.json({ received: true })
  }
}
