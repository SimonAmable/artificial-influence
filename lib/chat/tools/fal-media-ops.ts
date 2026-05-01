import { fal } from "@fal-ai/client"
import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { formatUploadMediaId } from "@/lib/chat/media-id"
import { resolveMediaRef } from "@/lib/chat/resolve-media-ref"
import { storeUploadedFileFromServer } from "@/lib/uploads/server"

const SUPPORTED_FAL_MEDIA_ENDPOINT_PREFIXES = ["fal-ai/ffmpeg-api/", "fal-ai/workflow-utilities/"] as const
const DEFAULT_MAX_PERSISTED_FILES = 12

type FalFileLike = {
  content_type?: string
  file_name?: string
  url?: string
}

function configureFal() {
  const key = process.env.FAL_KEY
  if (!key) {
    throw new Error("FAL_KEY is not configured.")
  }

  fal.config({ credentials: key })
}

function isSupportedFalMediaEndpoint(endpointId: string) {
  return SUPPORTED_FAL_MEDIA_ENDPOINT_PREFIXES.some((prefix) => endpointId.startsWith(prefix))
}

function inferMimeTypeFromUrl(url: string, fallback = "application/octet-stream") {
  const lower = url.toLowerCase()
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".gif")) return "image/gif"
  if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) return "video/mp4"
  if (lower.endsWith(".mov")) return "video/quicktime"
  if (lower.endsWith(".webm")) return "video/webm"
  if (lower.endsWith(".mp3")) return "audio/mpeg"
  if (lower.endsWith(".wav")) return "audio/wav"
  if (lower.endsWith(".ogg")) return "audio/ogg"
  if (lower.endsWith(".m4a")) return "audio/mp4"
  if (lower.endsWith(".aac")) return "audio/aac"
  return fallback
}

function inferFileNameFromUrl(url: string, fallback: string) {
  try {
    const pathname = new URL(url).pathname
    const last = pathname.split("/").filter(Boolean).at(-1)
    return last ? decodeURIComponent(last) : fallback
  } catch {
    return fallback
  }
}

async function resolveFalMediaInputValue(
  value: unknown,
  supabase: SupabaseClient,
  userId: string,
  threadId?: string,
): Promise<unknown> {
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => resolveFalMediaInputValue(item, supabase, userId, threadId)))
  }

  if (typeof value === "string") {
    if (value.startsWith("upl_") || value.startsWith("gen_")) {
      const resolved = await resolveMediaRef(supabase, userId, threadId, value, { allowCrossThread: true })
      return resolved.publicUrl
    }
    return value
  }

  if (value && typeof value === "object") {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(async ([key, childValue]) => [
        key,
        await resolveFalMediaInputValue(childValue, supabase, userId, threadId),
      ]),
    )
    return Object.fromEntries(entries)
  }

  return value
}

async function fetchBinary(url: string) {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Failed to download Fal output (${response.status}) from ${url}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return {
    bytes: arrayBuffer,
    contentType: response.headers.get("content-type") ?? undefined,
  }
}

async function attachUploadToThread(
  supabase: SupabaseClient,
  uploadId: string,
  threadId: string,
  label?: string,
) {
  const patch: Record<string, string> = { chat_thread_id: threadId }
  if (label && label.trim().length > 0) {
    patch.label = label.trim()
  }

  const { error } = await supabase.from("uploads").update(patch).eq("id", uploadId)
  if (error) {
    throw new Error(`Failed to attach Fal output to thread: ${error.message}`)
  }
}

async function persistFalFileOutput(args: {
  file: FalFileLike
  label?: string
  supabase: SupabaseClient
  threadId?: string
}) {
  const fileUrl = args.file.url
  if (!fileUrl) return null

  const fallbackName = inferFileNameFromUrl(fileUrl, "fal-media-output")
  const mimeType =
    typeof args.file.content_type === "string" && args.file.content_type.length > 0
      ? args.file.content_type
      : inferMimeTypeFromUrl(fileUrl)

  const { bytes, contentType } = await fetchBinary(fileUrl)
  const stored = await storeUploadedFileFromServer({
    fileName:
      typeof args.file.file_name === "string" && args.file.file_name.length > 0 ? args.file.file_name : fallbackName,
    mimeType: contentType && contentType.length > 0 ? contentType : mimeType,
    bytes,
    source: "fal-ffmpeg",
  })

  if (args.threadId) {
    await attachUploadToThread(args.supabase, stored.uploadId, args.threadId, args.label)
  }

  return {
    id: formatUploadMediaId(stored.uploadId),
    publicUrl: stored.url,
    mimeType: stored.mimeType,
    fileName: stored.fileName,
    label: args.label ?? null,
  }
}

function collectFalFileOutputs(data: Record<string, unknown>) {
  const files: Array<{ file: FalFileLike; label: string }> = []

  const maybePush = (value: unknown, label: string) => {
    if (!value || typeof value !== "object") return
    const candidate = value as FalFileLike
    if (typeof candidate.url === "string" && candidate.url.length > 0) {
      files.push({ file: candidate, label })
    }
  }

  maybePush(data.video, "Fal video output")
  maybePush(data.audio, "Fal audio output")
  maybePush(data.image, "Fal image output")

  if (typeof data.video_url === "string" && data.video_url.length > 0) {
    files.push({ file: { url: data.video_url }, label: "Fal video output" })
  }

  if (Array.isArray(data.images)) {
    data.images.forEach((image, index) => maybePush(image, `Fal image output ${index + 1}`))
  }

  return files
}

interface CreateFalMediaOpsToolOptions {
  supabase: SupabaseClient
  threadId?: string
  userId: string
}

export function createFalMediaOpsTool({ supabase, threadId, userId }: CreateFalMediaOpsToolOptions) {
  return tool({
    description:
      "Run a direct Fal FFmpeg/media utility operation and optionally persist the outputs back to thread media. Supports documented Fal endpoints under **fal-ai/ffmpeg-api/** and **fal-ai/workflow-utilities/**. Good for direct media transforms such as metadata inspection, merge-videos, merge-audio-video, merge-audios, loudnorm, trim-video, scale-video, reverse-video, auto-subtitle, extract-frame, extract-nth-frame, audio-compressor, impulse-response, and similar Fal media operations. You may pass thread media ids like `upl_...` or `gen_...` anywhere the Fal input expects a URL; the tool resolves them to public URLs automatically.",
    inputSchema: z.object({
      endpointId: z
        .string()
        .min(1)
        .refine(isSupportedFalMediaEndpoint, {
          message: "endpointId must start with fal-ai/ffmpeg-api/ or fal-ai/workflow-utilities/.",
        })
        .describe(
          "Exact Fal endpoint id, for example fal-ai/ffmpeg-api/metadata, fal-ai/ffmpeg-api/merge-videos, fal-ai/ffmpeg-api/merge-audio-video, fal-ai/ffmpeg-api/merge-audios, fal-ai/ffmpeg-api/loudnorm, fal-ai/workflow-utilities/trim-video, fal-ai/workflow-utilities/scale-video, fal-ai/workflow-utilities/reverse-video, fal-ai/workflow-utilities/auto-subtitle, fal-ai/workflow-utilities/audio-compressor, or fal-ai/workflow-utilities/impulse-response.",
        ),
      input: z
        .record(z.string(), z.unknown())
        .describe(
          "Fal input payload for that endpoint. Any string values equal to a thread media id like upl_... or gen_... are automatically resolved to public URLs.",
        ),
      persistToThread: z
        .boolean()
        .optional()
        .describe(
          "When true and the chat thread is persisted, store file outputs back into thread uploads so later tools can reuse them via listThreadMedia. Default true when threadId exists, otherwise false.",
        ),
      maxPersistedFiles: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Maximum number of output files to persist back to thread uploads. Default 12."),
      outputLabel: z
        .string()
        .optional()
        .describe("Optional label prefix to use when persisting outputs back to thread media."),
    }),
    execute: async ({
      endpointId,
      input,
      persistToThread,
      maxPersistedFiles = DEFAULT_MAX_PERSISTED_FILES,
      outputLabel,
    }) => {
      configureFal()

      const resolvedInput = (await resolveFalMediaInputValue(input, supabase, userId, threadId)) as Record<
        string,
        unknown
      >

      const result = await fal.subscribe(endpointId as never, {
        input: resolvedInput as never,
        logs: false,
        mode: "polling",
        pollInterval: 750,
      })

      const data = (result.data ?? {}) as Record<string, unknown>
      const shouldPersist = Boolean((persistToThread ?? Boolean(threadId)) && threadId)
      const collectedFiles = collectFalFileOutputs(data)
      const persistedFiles = shouldPersist
        ? await Promise.all(
            collectedFiles.slice(0, maxPersistedFiles).map((entry, index) =>
              persistFalFileOutput({
                file: entry.file,
                supabase,
                threadId,
                label:
                  outputLabel && outputLabel.trim().length > 0
                    ? `${outputLabel.trim()}${collectedFiles.length > 1 ? ` ${index + 1}` : ""}`
                    : entry.label,
              }),
            ),
          )
        : []

      return {
        endpointId,
        resolvedInput,
        result: data,
        persisted:
          shouldPersist && persistedFiles.length > 0
            ? {
                fileCount: persistedFiles.filter(Boolean).length,
                truncated: collectedFiles.length > maxPersistedFiles,
                files: persistedFiles.filter(Boolean),
              }
            : null,
      }
    },
  })
}
