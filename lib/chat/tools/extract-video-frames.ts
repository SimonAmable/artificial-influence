import { execSync, spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import ffmpegInstaller from "ffmpeg-static"
import ffprobeInstaller from "ffprobe-static"
import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { inferStoragePathFromUrl } from "@/lib/assets/library"
import { formatUploadMediaId, mediaIdStringSchema } from "@/lib/chat/media-id"
import { resolveThreadMediaIdToFrameExtractReference } from "@/lib/chat/thread-media/server"
import type {
  AvailableChatImageReference,
  ChatImageReference,
} from "@/lib/chat/tools/image-reference-types"
import type { AvailableChatVideoReference, ChatVideoReference } from "@/lib/chat/tools/generate-video"

const MAX_SOURCE_BYTES = 50 * 1024 * 1024
const MAX_FRAME_COUNT = 24
const LAST_FRAME_EPSILON_SEC = 0.05

function tryBinaryFromShell(command: string): string | null {
  try {
    const stdout = execSync(command, { encoding: "utf8", windowsHide: true }).trim()
    const line = stdout.split(/\r?\n/).find((entry) => entry.length > 0)
    if (!line) return null
    const candidate = line.trim()
    return existsSync(candidate) ? candidate : null
  } catch {
    return null
  }
}

function resolveFfmpegBinaryPath(): string | null {
  const fromEnv = process.env.FFMPEG_BINARY ?? process.env.FFMPEG_PATH
  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv
  }

  const fromPackage = typeof ffmpegInstaller === "string" ? ffmpegInstaller : null
  if (fromPackage && existsSync(fromPackage)) {
    return fromPackage
  }

  return tryBinaryFromShell(process.platform === "win32" ? "where ffmpeg" : "command -v ffmpeg")
}

function resolveFfprobeBinaryPath(): string | null {
  const fromEnv = process.env.FFPROBE_BINARY ?? process.env.FFPROBE_PATH
  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv
  }

  const packaged =
    ffprobeInstaller && typeof ffprobeInstaller === "object" && "path" in ffprobeInstaller
      ? String((ffprobeInstaller as { path: string }).path)
      : null
  if (packaged && existsSync(packaged)) {
    return packaged
  }

  return tryBinaryFromShell(process.platform === "win32" ? "where ffprobe" : "command -v ffprobe")
}

interface CreateExtractVideoFramesToolOptions {
  availableImageReferences: AvailableChatImageReference[]
  availableVideoReferences: AvailableChatVideoReference[]
  supabase: SupabaseClient
  threadId?: string
  userId: string
}

function getImageExtensionForMime(mime: "image/jpeg" | "image/png") {
  return mime === "image/jpeg" ? "jpg" : "png"
}

function sanitizeFileStem(value: string | undefined, fallback: string) {
  const cleaned = value
    ?.replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
  return cleaned && cleaned.length > 0 ? cleaned.toLowerCase() : fallback
}

function validateReferenceUrl(url: string) {
  if (url.startsWith("data:")) return

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error("Reference media URL is invalid.")
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const isAllowedSupabaseUrl = (() => {
    if (!supabaseUrl) return false
    try {
      const parsedSupabaseUrl = new URL(supabaseUrl)
      return (
        parsedUrl.origin === parsedSupabaseUrl.origin &&
        parsedUrl.pathname.startsWith("/storage/v1/object/public/public-bucket/")
      )
    } catch {
      return false
    }
  })()

  const isAllowedAppUrl = (() => {
    if (!appUrl) return false
    try {
      const parsedAppUrl = new URL(appUrl)
      return parsedUrl.origin === parsedAppUrl.origin
    } catch {
      return false
    }
  })()

  if (!isAllowedSupabaseUrl && !isAllowedAppUrl) {
    throw new Error("Reference media URLs must come from this app's stored assets.")
  }
}

function parseDataUrlSource(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/)
  if (!match) {
    throw new Error("Only base64 data URLs are supported for chat media references.")
  }
  const [, mimeType, base64] = match
  const buffer = Buffer.from(base64, "base64")
  if (buffer.byteLength > MAX_SOURCE_BYTES) {
    throw new Error("Attached media is too large for frame extraction.")
  }
  const normalized = mimeType.toLowerCase()
  if (!normalized.startsWith("video/") && normalized !== "image/gif") {
    throw new Error("Only video or GIF attachments can be used for frame extraction.")
  }
  return { buffer, mimeType }
}

function sourceExtensionFromMime(mimeType: string) {
  const normalized = mimeType.toLowerCase()
  if (normalized === "image/gif") return "gif"
  if (normalized === "video/webm") return "webm"
  if (normalized === "video/quicktime") return "mov"
  return "mp4"
}

function isGifReference(reference: { mediaType?: string; url: string }) {
  const normalized = reference.mediaType?.toLowerCase()
  if (normalized === "image/gif") return true
  try {
    const parsed = new URL(reference.url)
    return parsed.pathname.toLowerCase().endsWith(".gif")
  } catch {
    return false
  }
}

const TRANSCRIPT_IMAGE_REF_RE = /^ref_\d+$/
const TRANSCRIPT_VIDEO_REF_RE = /^refv_\d+$/

function resolveTranscriptRefForFrameExtract({
  referenceId,
  imageMap,
  videoMap,
}: {
  referenceId: string
  imageMap: Map<string, AvailableChatImageReference>
  videoMap: Map<string, AvailableChatVideoReference>
}): ChatVideoReference | ChatImageReference {
  const trimmed = referenceId.trim()
  if (TRANSCRIPT_VIDEO_REF_RE.test(trimmed)) {
    const video = videoMap.get(trimmed)
    if (!video) {
      throw new Error(
        `Video reference "${trimmed}" is not in this conversation's transcript (refv_1, refv_2, …). Use listThreadMedia or attach a video.`,
      )
    }
    return {
      url: video.url,
      mediaType: video.mediaType,
      filename: video.filename,
    }
  }
  if (TRANSCRIPT_IMAGE_REF_RE.test(trimmed)) {
    const image = imageMap.get(trimmed)
    if (!image) {
      throw new Error(
        `Image reference "${trimmed}" is not in this conversation's transcript (ref_1, ref_2, …). Use listThreadMedia or attach a GIF.`,
      )
    }
    if (!isGifReference(image)) {
      throw new Error(
        `ref_N for frame extraction must be a GIF (image/gif). For video files use refv_N or mediaId.`,
      )
    }
    return {
      url: image.url,
      mediaType: image.mediaType,
      filename: image.filename,
    }
  }
  throw new Error(
    `Invalid referenceId "${referenceId}". Expected refv_N for video or ref_N for an attached GIF.`,
  )
}

async function downloadSourceToBuffer(url: string): Promise<Buffer> {
  validateReferenceUrl(url)
  if (url.startsWith("data:")) {
    return parseDataUrlSource(url).buffer
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download source media (${response.status}).`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  if (buffer.byteLength > MAX_SOURCE_BYTES) {
    throw new Error("Media is too large for frame extraction.")
  }
  return buffer
}

async function loadFrameExtractAssetById(assetId: string, supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("assets")
    .select("id, user_id, asset_type, asset_url, visibility, title")
    .eq("id", assetId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load asset: ${error.message}`)
  }

  const row = data as
    | {
        id: string
        user_id: string
        asset_type: string
        asset_url: string
        visibility: string
        title: string | null
      }
    | null

  if (!row) {
    throw new Error("Saved asset not found.")
  }

  if (row.user_id !== userId && row.visibility !== "public") {
    throw new Error("You do not have access to that asset.")
  }

  const url = String(row.asset_url)
  const isGifAsset =
    row.asset_type === "image" &&
    (() => {
      try {
        const parsedUrl = new URL(url)
        return parsedUrl.pathname.toLowerCase().endsWith(".gif")
      } catch {
        return false
      }
    })()

  if (row.asset_type !== "video" && !isGifAsset) {
    throw new Error("That asset is not a video or GIF. Use searchAssets to find a video or animated GIF asset.")
  }

  validateReferenceUrl(url)

  return {
    url,
    mediaType: isGifAsset ? "image/gif" : "video/mp4",
    filename: typeof row.title === "string" ? row.title : undefined,
  }
}

function runCapture(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true })
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    child.stdout?.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
    child.stderr?.on("data", (chunk) => errChunks.push(Buffer.from(chunk)))
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString("utf8"))
      } else {
        reject(new Error(errChunks.join("") || `Process exited with code ${code}`))
      }
    })
  })
}

async function runFfmpegCapture(ffmpeg: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { windowsHide: true })
    const errChunks: Buffer[] = []
    child.stderr?.on("data", (chunk) => errChunks.push(Buffer.from(chunk)))
    child.on("error", reject)
    child.on("close", (code) => {
      const stderr = Buffer.concat(errChunks).toString("utf8")
      if (code === 0) {
        resolve(stderr)
      } else {
        reject(new Error(stderr || `ffmpeg exited with code ${code}`))
      }
    })
  })
}

function parseFirstFiniteNumber(output: string): number | null {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.toUpperCase() !== "N/A")

  for (const line of lines) {
    const value = Number.parseFloat(line)
    if (Number.isFinite(value) && value > 0) {
      return value
    }
  }

  return null
}

function parseFpsFromRatio(rawRatio: string): number | null {
  const ratio = rawRatio.trim()
  if (!ratio || ratio.toUpperCase() === "N/A") return null

  if (ratio.includes("/")) {
    const [numRaw, denRaw] = ratio.split("/", 2)
    const num = Number.parseFloat(numRaw ?? "")
    const den = Number.parseFloat(denRaw ?? "")
    if (Number.isFinite(num) && Number.isFinite(den) && den > 0) {
      const fps = num / den
      return fps > 0 ? fps : null
    }
    return null
  }

  const direct = Number.parseFloat(ratio)
  return Number.isFinite(direct) && direct > 0 ? direct : null
}

async function probeDurationSeconds(videoPath: string, ffprobePath: string): Promise<number> {
  const formatDurationOutput = await runCapture(ffprobePath, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    videoPath,
  ])
  const formatDuration = parseFirstFiniteNumber(formatDurationOutput)
  if (formatDuration) {
    return formatDuration
  }

  const streamDurationOutput = await runCapture(ffprobePath, [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    videoPath,
  ])
  const streamDuration = parseFirstFiniteNumber(streamDurationOutput)
  if (streamDuration) {
    return streamDuration
  }

  // GIF and some VFR media can miss format/stream duration; estimate from frame count + FPS.
  const frameMetaOutput = await runCapture(ffprobePath, [
    "-v",
    "error",
    "-count_frames",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=nb_read_frames,r_frame_rate,avg_frame_rate",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    videoPath,
  ])
  const frameMetaLines = frameMetaOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.toUpperCase() !== "N/A")

  if (frameMetaLines.length >= 2) {
    const frameCount = Number.parseInt(frameMetaLines[0] ?? "", 10)
    const fps =
      parseFpsFromRatio(frameMetaLines[1] ?? "") ?? parseFpsFromRatio(frameMetaLines[2] ?? "")

    if (Number.isFinite(frameCount) && frameCount > 0 && fps && fps > 0) {
      const estimatedDuration = frameCount / fps
      if (Number.isFinite(estimatedDuration) && estimatedDuration > 0) {
        return estimatedDuration
      }
    }
  }

  throw new Error("Could not read source duration (ffprobe).")
}

function buildFramePlan(options: {
  durationSec: number
  includeFirst: boolean
  includeLast: boolean
  evenlySpacedInteriorCount: number
  extraTimestampsSec: number[]
}): Array<{ t: number; kind: string }> {
  const d = options.durationSec
  const lastSeek = Math.max(0, d - LAST_FRAME_EPSILON_SEC)
  const byKey = new Map<number, { t: number; kind: string }>()

  const upsert = (t: number, kind: string) => {
    const clamped = Math.min(Math.max(0, t), lastSeek)
    const key = Math.round(clamped * 1000)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { t: clamped, kind })
      return
    }
    if (
      (existing.kind === "first" && kind === "last") ||
      (existing.kind === "last" && kind === "first")
    ) {
      byKey.set(key, { t: clamped, kind: "first-last" })
      return
    }
    if (kind === "first" || kind === "last") {
      byKey.set(key, { t: clamped, kind })
    }
  }

  if (options.includeFirst) {
    upsert(0, "first")
  }
  if (options.includeLast && d > 0) {
    upsert(lastSeek, "last")
  }

  const n = options.evenlySpacedInteriorCount
  if (n > 0 && d > 0) {
    for (let i = 1; i <= n; i += 1) {
      upsert((d * i) / (n + 1), `interior-${i}`)
    }
  }

  for (const raw of options.extraTimestampsSec) {
    if (Number.isFinite(raw) && raw >= 0) {
      upsert(raw, `t=${raw.toFixed(2)}s`)
    }
  }

  return [...byKey.values()].sort((a, b) => a.t - b.t)
}

async function uploadFrameBuffer({
  buffer,
  filenameHint,
  mimeType,
  supabase,
  userId,
}: {
  buffer: Buffer
  filenameHint: string
  mimeType: "image/jpeg" | "image/png"
  supabase: SupabaseClient
  userId: string
}) {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).slice(2, 10)
  const extension = getImageExtensionForMime(mimeType)
  const safeStem = sanitizeFileStem(filenameHint, "frame")
  const storagePath = `${userId}/chat-video-frame-extracts/${timestamp}-${safeStem}-${randomStr}.${extension}`

  const { error: uploadError } = await supabase.storage.from("public-bucket").upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: false,
  })

  if (uploadError) {
    throw new Error(`Failed to upload extracted frame: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage.from("public-bucket").getPublicUrl(storagePath)

  return {
    mimeType,
    storagePath,
    url: urlData.publicUrl,
  }
}

async function extractFrameToBuffer(options: {
  ffmpegPath: string
  inputPath: string
  timestampSec: number
  outputMime: "image/jpeg" | "image/png"
  maxEdgePx?: number
  workDir: string
  index: number
}): Promise<Buffer> {
  const ext = getImageExtensionForMime(options.outputMime)
  const outPath = join(options.workDir, `out-${options.index}.${ext}`)
  const vf =
    typeof options.maxEdgePx === "number"
      ? `scale=min(${options.maxEdgePx}\\,iw):min(${options.maxEdgePx}\\,ih):force_original_aspect_ratio=decrease`
      : undefined

  const buildArgs = (timestampSec: number, seekAfterInput: boolean) => {
    const args = ["-hide_banner", "-loglevel", "error", "-y"]
    if (seekAfterInput) {
      args.push("-i", options.inputPath, "-ss", String(timestampSec))
    } else {
      args.push("-ss", String(timestampSec), "-i", options.inputPath)
    }
    args.push("-frames:v", "1")
    if (vf) {
      args.push("-vf", vf)
    }
    if (options.outputMime === "image/jpeg") {
      args.push("-q:v", "2")
    }
    args.push(outPath)
    return args
  }

  // Some codecs/clips near EOF report success but don't emit an output frame.
  // Try a small sequence of fallback seeks/layouts before failing.
  const attempts: Array<{ timestampSec: number; seekAfterInput: boolean }> = [
    { timestampSec: options.timestampSec, seekAfterInput: false },
    { timestampSec: Math.max(0, options.timestampSec - 0.2), seekAfterInput: false },
    { timestampSec: options.timestampSec, seekAfterInput: true },
    { timestampSec: Math.max(0, options.timestampSec - 0.5), seekAfterInput: true },
  ]

  let lastStderr = ""
  for (const attempt of attempts) {
    const args = buildArgs(attempt.timestampSec, attempt.seekAfterInput)
    try {
      lastStderr = await runFfmpegCapture(options.ffmpegPath, args)
      if (existsSync(outPath)) {
        return readFile(outPath)
      }
    } catch (error) {
      lastStderr = error instanceof Error ? error.message : String(error)
    }
  }

  throw new Error(
    `ffmpeg did not produce a frame image at ${options.timestampSec.toFixed(2)}s. ${
      lastStderr.trim() ? `Details: ${lastStderr.trim()}` : ""
    }`.trim(),
  )
}

export function createExtractVideoFramesTool({
  availableImageReferences,
  availableVideoReferences,
  supabase,
  threadId,
  userId,
}: CreateExtractVideoFramesToolOptions) {
  const imageMap = new Map(availableImageReferences.map((r) => [r.id, r] as const))
  const videoMap = new Map(availableVideoReferences.map((r) => [r.id, r] as const))

  return tool({
    description:
      "Extract still frames from a user-owned video or animated GIF (first and last frame by default, optional interior samples and explicit timestamps). Uses ffmpeg. Pass **referenceId** `refv_N` for a video or `ref_N` for an attached GIF (transcript manifest), **mediaId** from listThreadMedia (`upl_`/`gen_`), or **assetId** from searchAssets. Uploaded frames are registered on the thread when threadId exists so their ids can be used as mediaIds on image tools.",
    inputSchema: z.object({
      referenceId: z
        .string()
        .min(1)
        .optional()
        .describe(
          "Transcript ref: refv_N for video, ref_N for GIF. Mutually exclusive with mediaId and assetId.",
        ),
      mediaId: mediaIdStringSchema
        .optional()
        .describe(
          "Media id from listThreadMedia for a video or GIF row (`upl_`/`gen_` or legacy UUID). Requires a persisted thread.",
        ),
      assetId: z
        .string()
        .uuid()
        .optional()
        .describe("Saved video/GIF asset id from searchAssets. Pass only one of referenceId, mediaId, or assetId."),
      includeFirst: z.boolean().optional().describe("Include the first frame (default true)."),
      includeLast: z.boolean().optional().describe("Include a frame near the end (default true)."),
      evenlySpacedInteriorCount: z
        .number()
        .int()
        .min(0)
        .max(12)
        .optional()
        .describe(
          "Additional frames strictly between start and end, evenly spaced in time (0–12, default 0).",
        ),
      extraTimestampsSec: z
        .array(z.number().min(0))
        .max(12)
        .optional()
        .describe("Extra sample times in seconds from the start of the file (max 12)."),
      outputFormat: z
        .enum(["jpeg", "png"])
        .optional()
        .describe("Output image format (default jpeg)."),
      maxEdgePx: z
        .number()
        .int()
        .min(256)
        .max(4096)
        .optional()
        .describe("If set, downscale so width and height do not exceed this value."),
      persistToThread: z
        .boolean()
        .optional()
        .describe(
          "When true (default) and the chat thread is persisted, register each frame in uploads for mediaIds. Set false for one-off previews.",
        ),
    }),
    strict: true,
    execute: async ({
      referenceId,
      mediaId,
      assetId,
      includeFirst = true,
      includeLast = true,
      evenlySpacedInteriorCount = 0,
      extraTimestampsSec = [],
      outputFormat = "jpeg",
      maxEdgePx,
      persistToThread = true,
    }) => {
      const ffmpegPath = resolveFfmpegBinaryPath()
      const ffprobePath = resolveFfprobeBinaryPath()

      if (!ffmpegPath || !ffprobePath) {
        throw new Error(
          "Frame extraction needs ffmpeg and ffprobe on the server. Install ffmpeg on PATH, set FFMPEG_BINARY and FFPROBE_BINARY, or allow the ffmpeg-static postinstall (pnpm onlyBuiltDependencies includes ffmpeg-static) then run pnpm install.",
        )
      }

      const sourceSelectors = [referenceId, mediaId, assetId].filter(Boolean)
      if (sourceSelectors.length > 1) {
        throw new Error("Pass only one of referenceId, mediaId, or assetId.")
      }

      let source: ChatVideoReference | ChatImageReference

      if (referenceId) {
        source = resolveTranscriptRefForFrameExtract({
          referenceId,
          imageMap,
          videoMap,
        })
      } else if (mediaId) {
        if (!threadId) {
          throw new Error("mediaId requires a persisted chat thread. Ask the user to continue in a saved thread.")
        }
        source = await resolveThreadMediaIdToFrameExtractReference(supabase, userId, threadId, mediaId)
      } else if (assetId) {
        source = await loadFrameExtractAssetById(assetId, supabase, userId)
      } else {
        throw new Error(
          "Pass referenceId (refv_N or ref_N for GIF), mediaId from listThreadMedia, or assetId from searchAssets.",
        )
      }

      if (!includeFirst && !includeLast && evenlySpacedInteriorCount === 0 && extraTimestampsSec.length === 0) {
        throw new Error(
          "No frames requested. Enable includeFirst/includeLast, set evenlySpacedInteriorCount, or pass extraTimestampsSec.",
        )
      }

      const upperBound =
        (includeFirst ? 1 : 0) +
        (includeLast ? 1 : 0) +
        evenlySpacedInteriorCount +
        extraTimestampsSec.length
      if (upperBound > MAX_FRAME_COUNT) {
        throw new Error(
          `Too many frames requested (about ${upperBound}). Reduce interior count or extra timestamps (max ${MAX_FRAME_COUNT}).`,
        )
      }

      const outputMime: "image/jpeg" | "image/png" = outputFormat === "png" ? "image/png" : "image/jpeg"
      const workDir = await mkdtemp(join(tmpdir(), "unican-frames-"))
      const inputExt = sourceExtensionFromMime(source.mediaType ?? "video/mp4")
      const inputPath = join(workDir, `input.${inputExt}`)

      try {
        const sourceBuffer = await downloadSourceToBuffer(source.url)
        await writeFile(inputPath, sourceBuffer)

        const durationSec = await probeDurationSeconds(inputPath, ffprobePath)
        const resolvedPlan = buildFramePlan({
          durationSec,
          includeFirst,
          includeLast,
          evenlySpacedInteriorCount,
          extraTimestampsSec,
        })

        if (resolvedPlan.length === 0) {
          throw new Error("No frames to extract after resolving timestamps.")
        }

        if (resolvedPlan.length > MAX_FRAME_COUNT) {
          throw new Error(
            `Too many frames (${resolvedPlan.length}). Reduce interior count or extra timestamps (max ${MAX_FRAME_COUNT}).`,
          )
        }

        const stem = sanitizeFileStem(source.filename, "video")

        const buffers = await Promise.all(
          resolvedPlan.map((point, index) =>
            extractFrameToBuffer({
              ffmpegPath,
              inputPath,
              timestampSec: point.t,
              outputMime,
              maxEdgePx,
              workDir,
              index,
            }),
          ),
        )

        const uploaded = await Promise.all(
          buffers.map((buffer, index) => {
            const point = resolvedPlan[index]!
            const label =
              point.kind === "first"
                ? "Extracted: first frame"
                : point.kind === "last"
                  ? "Extracted: last frame"
                  : point.kind === "first-last"
                    ? "Extracted: first & last (short clip)"
                    : `Extracted: ${point.kind} @ ${point.t.toFixed(2)}s`
            return uploadFrameBuffer({
              buffer,
              filenameHint: `${stem}-${point.kind}-${index}`,
              mimeType: outputMime,
              supabase,
              userId,
            }).then((asset) => ({ ...asset, label, timestampSec: point.t, kind: point.kind }))
          }),
        )

        const shouldPersist = Boolean(threadId && persistToThread)
        let mediaRows: Array<{ id: string; publicUrl: string; label: string; timestampSec: number }> = []

        if (shouldPersist) {
          const insertPayload = uploaded.map((item) => {
            const storagePath = inferStoragePathFromUrl(item.url)
            if (!storagePath) {
              throw new Error("Could not infer storage path for extracted frame upload.")
            }
            return {
              user_id: userId,
              chat_thread_id: threadId!,
              source: "frame-extraction" as const,
              bucket: "public-bucket" as const,
              mime_type: item.mimeType,
              storage_path: storagePath,
              label: item.label,
            }
          })

          const { data: inserted, error: insertError } = await supabase
            .from("uploads")
            .insert(insertPayload)
            .select("id, storage_path, label")

          if (insertError) {
            throw new Error(`Failed to register extracted frames on thread: ${insertError.message}`)
          }

          const rows = (inserted ?? []) as Array<{ id: string; storage_path: string; label: string | null }>
          mediaRows = rows.map((row, index) => ({
            id: formatUploadMediaId(row.id),
            publicUrl: supabase.storage.from("public-bucket").getPublicUrl(row.storage_path).data.publicUrl,
            label: row.label ?? uploaded[index]!.label,
            timestampSec: uploaded[index]!.timestampSec,
          }))
        }

        return {
          videoDurationSec: durationSec,
          frameCount: uploaded.length,
          frames: uploaded.map((item, index) => ({
            timestampSec: item.timestampSec,
            kind: item.kind,
            label: item.label,
            mimeType: item.mimeType,
            publicUrl: item.url,
            mediaId: mediaRows[index]?.id,
          })),
          persistedToThread: shouldPersist,
          note: shouldPersist
            ? "Use listThreadMedia if you need refreshed ids; new rows are appended for these frames."
            : "Frames were not written to uploads (no thread or persistToThread was false). Use publicUrl directly where allowed.",
        }
      } finally {
        await rm(workDir, { recursive: true, force: true })
      }
    },
  })
}
