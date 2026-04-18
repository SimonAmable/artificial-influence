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

import { checkUserHasCredits, deductUserCredits } from "@/lib/credits"
import { mediaIdStringSchema } from "@/lib/chat/media-id"
import { resolveThreadMediaRowsForTimelineCompose } from "@/lib/chat/thread-media/server"
import { COMPOSITION_ASPECT_PRESETS } from "@/lib/video-editor/composition-presets"

const COMPOSE_TIMELINE_CREDITS = 2
const MAX_SEGMENTS = 15
const MAX_OUTPUT_DURATION_SEC = 120
const MAX_SOURCE_BYTES = 50 * 1024 * 1024
const DEFAULT_IMAGE_DURATION_SEC = 3


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

async function downloadToFile(url: string, destPath: string): Promise<void> {
  validateReferenceUrl(url)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download media (${response.status}).`)
  }
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  if (buffer.byteLength > MAX_SOURCE_BYTES) {
    throw new Error("A source file is too large for timeline composition.")
  }
  await writeFile(destPath, buffer)
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

async function runFfmpeg(ffmpeg: string, args: string[], cwd?: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpeg, args, { windowsHide: true, cwd })
    const errChunks: Buffer[] = []
    child.stderr?.on("data", (chunk) => errChunks.push(Buffer.from(chunk)))
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve()
      } else {
        const stderr = Buffer.concat(errChunks).toString("utf8")
        reject(new Error(stderr || `ffmpeg exited with code ${code}`))
      }
    })
  })
}

function extensionFromMime(mime: string) {
  const m = mime.toLowerCase()
  if (m === "image/jpeg") return "jpg"
  if (m === "image/png") return "png"
  if (m === "image/webp") return "webp"
  if (m === "image/gif") return "gif"
  if (m === "video/mp4") return "mp4"
  if (m === "video/webm") return "webm"
  if (m === "video/quicktime") return "mov"
  return "bin"
}

function classifyMedia(mime: string): "static_image" | "gif" | "video" {
  const m = mime.toLowerCase()
  if (m === "image/gif") return "gif"
  if (m.startsWith("video/")) return "video"
  if (m.startsWith("image/")) return "static_image"
  throw new Error(`Unsupported media type for timeline composition: ${mime}`)
}

function vfScaleCrop(w: number, h: number): string {
  return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}:(iw-ow)/2:(ih-oh)/2,format=yuv420p`
}

interface CreateComposeTimelineVideoToolOptions {
  supabase: SupabaseClient
  threadId?: string
  userId: string
}

const OUTPUT_PRESET_IDS = COMPOSITION_ASPECT_PRESETS.map((p) => p.id) as [string, ...string[]]

export function createComposeTimelineVideoTool({
  supabase,
  threadId,
  userId,
}: CreateComposeTimelineVideoToolOptions) {
  return tool({
    description:
      "Assemble existing thread media into a single MP4 video (no AI generation). Use **listThreadMedia** first to get `mediaIds`. Supports **images** (PNG/JPEG/WebP), **GIFs**, and **videos** (MP4/WebM/MOV) in order. Each image/GIF uses a **durationSeconds** (default 3s for static images). Video segments can use **trimStartSeconds** / **trimEndSeconds**. Output is **muted** (no audio). Choose **outputPreset** for 16:9 (e.g. 16:9-1080) or 9:16 (e.g. 9:16-1080).",
    inputSchema: z.object({
      segments: z
        .array(
          z.object({
            mediaId: mediaIdStringSchema,
            durationSeconds: z
              .number()
              .min(0.5)
              .max(60)
              .optional()
              .describe("Hold duration for static images and GIFs (ignored for video segments)."),
            trimStartSeconds: z
              .number()
              .min(0)
              .optional()
              .describe("For video segments only: start time in the source file (seconds)."),
            trimEndSeconds: z
              .number()
              .min(0)
              .optional()
              .describe("For video segments only: end time in the source file (seconds)."),
          }),
        )
        .min(1)
        .max(MAX_SEGMENTS),
      outputPreset: z
        .enum(OUTPUT_PRESET_IDS)
        .describe("Canvas size: e.g. 16:9-1080, 9:16-1080, 16:9-720."),
      fps: z
        .number()
        .int()
        .min(12)
        .max(60)
        .optional()
        .describe("Output frame rate (default 30)."),
    }),
    execute: async ({ segments, outputPreset, fps = 30 }) => {
      if (!threadId) {
        throw new Error("Timeline composition requires a persisted chat thread (threadId).")
      }

      const ffmpeg = resolveFfmpegBinaryPath()
      const ffprobe = resolveFfprobeBinaryPath()
      if (!ffmpeg || !ffprobe) {
        throw new Error("ffmpeg or ffprobe is not available on the server.")
      }

      const hasCredits = await checkUserHasCredits(userId, COMPOSE_TIMELINE_CREDITS, supabase)
      if (!hasCredits) {
        throw new Error(`Insufficient credits. Composing a timeline requires ${COMPOSE_TIMELINE_CREDITS} credits.`)
      }

      const preset = COMPOSITION_ASPECT_PRESETS.find((p) => p.id === outputPreset)
      if (!preset) {
        throw new Error(`Unknown output preset: ${outputPreset}`)
      }
      const { width: W, height: H } = preset

      const mediaIds = segments.map((s) => s.mediaId)
      const rows = await resolveThreadMediaRowsForTimelineCompose(supabase, userId, threadId, mediaIds)

      for (let i = 0; i < segments.length; i += 1) {
        const seg = segments[i]!
        const row = rows[i]!
        const kind = classifyMedia(row.mime_type)
        if (kind === "video") {
          const trimStart = seg.trimStartSeconds ?? 0
          const trimEnd = seg.trimEndSeconds
          if (trimEnd != null && trimEnd <= trimStart) {
            throw new Error("trimEndSeconds must be greater than trimStartSeconds for video segments.")
          }
        }
      }

      const workDir = await mkdtemp(join(tmpdir(), "compose-timeline-"))
      const vf = vfScaleCrop(W, H)

      try {
        const segmentFiles: string[] = []

        for (let i = 0; i < segments.length; i += 1) {
          const seg = segments[i]!
          const row = rows[i]!
          const kind = classifyMedia(row.mime_type)
          const ext = extensionFromMime(row.mime_type)
          const rawPath = join(workDir, `raw-${i}.${ext}`)
          await downloadToFile(row.public_url, rawPath)

          const outName = `seg${String(i).padStart(3, "0")}.mp4`
          const outPath = join(workDir, outName)

          if (kind === "static_image") {
            const dur = seg.durationSeconds ?? DEFAULT_IMAGE_DURATION_SEC
            await runFfmpeg(
              ffmpeg,
              [
              "-y",
              "-loop",
              "1",
              "-i",
              rawPath,
              "-t",
              String(dur),
              "-vf",
              vf,
              "-r",
              String(fps),
              "-c:v",
              "libx264",
              "-pix_fmt",
              "yuv420p",
              "-movflags",
              "+faststart",
              outPath,
            ],
              workDir,
            )
          } else if (kind === "gif") {
            const dur = seg.durationSeconds ?? 10
            await runFfmpeg(
              ffmpeg,
              [
              "-y",
              "-stream_loop",
              "-1",
              "-i",
              rawPath,
              "-t",
              String(dur),
              "-vf",
              vf,
              "-r",
              String(fps),
              "-an",
              "-c:v",
              "libx264",
              "-pix_fmt",
              "yuv420p",
              "-movflags",
              "+faststart",
              outPath,
            ],
              workDir,
            )
          } else {
            const fullDur = await probeDurationSeconds(rawPath, ffprobe)
            const start = seg.trimStartSeconds ?? 0
            let end = seg.trimEndSeconds ?? fullDur
            if (end > fullDur) end = fullDur
            if (end <= start) {
              throw new Error("Video trim range is empty or invalid for one segment.")
            }
            const t = end - start
            if (t > MAX_OUTPUT_DURATION_SEC) {
              throw new Error("A single video segment exceeds the maximum allowed duration.")
            }
            await runFfmpeg(
              ffmpeg,
              [
              "-y",
              "-ss",
              String(start),
              "-i",
              rawPath,
              "-t",
              String(t),
              "-vf",
              vf,
              "-r",
              String(fps),
              "-an",
              "-c:v",
              "libx264",
              "-pix_fmt",
              "yuv420p",
              "-movflags",
              "+faststart",
              outPath,
            ],
              workDir,
            )
          }

          segmentFiles.push(outName)
        }

        const listPath = join(workDir, "list.txt")
        const listBody = segmentFiles.map((name) => `file '${name.replace(/'/g, "'\\''")}'`).join("\n")
        await writeFile(listPath, listBody, "utf8")

        const mergedPath = join(workDir, "merged.mp4")
        await runFfmpeg(
          ffmpeg,
          ["-y", "-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "merged.mp4"],
          workDir,
        )

        const outBuffer = await readFile(mergedPath)
        const probeDur = await probeDurationSeconds(mergedPath, ffprobe)
        if (probeDur > MAX_OUTPUT_DURATION_SEC + 1) {
          throw new Error(`Output duration ${probeDur.toFixed(1)}s exceeds the maximum.`)
        }

        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).slice(2, 10)
        const storagePath = `${userId}/chat-compose-timeline/${timestamp}-${randomStr}.mp4`
        const { error: uploadError } = await supabase.storage
          .from("public-bucket")
          .upload(storagePath, outBuffer, {
            contentType: "video/mp4",
            upsert: false,
          })

        if (uploadError) {
          throw new Error(`Failed to upload composed video: ${uploadError.message}`)
        }

        const { data: urlData } = supabase.storage.from("public-bucket").getPublicUrl(storagePath)
        const publicUrl = urlData.publicUrl

        const deducted = await deductUserCredits(userId, COMPOSE_TIMELINE_CREDITS, supabase)
        if (deducted < 0) {
          throw new Error("Failed to deduct credits after composition.")
        }

        const { error: insertError } = await supabase.from("uploads").insert({
          user_id: userId,
          chat_thread_id: threadId,
          source: "compose",
          bucket: "public-bucket",
          mime_type: "video/mp4",
          storage_path: storagePath,
          label: `Composed timeline (${preset.label})`,
          duration_seconds: probeDur,
        })

        if (insertError && insertError.code !== "23505") {
          console.error("[composeTimelineVideo] uploads insert failed:", insertError.message)
        }

        return {
          status: "completed" as const,
          message: `Composed ${segments.length} segment(s) into one ${preset.label} video (muted).`,
          creditsUsed: COMPOSE_TIMELINE_CREDITS,
          outputPreset,
          width: W,
          height: H,
          fps,
          videoDurationSec: probeDur,
          segmentCount: segments.length,
          video: {
            mimeType: "video/mp4",
            url: publicUrl,
            storagePath,
          },
        }
      } finally {
        await rm(workDir, { recursive: true, force: true })
      }
    },
  })
}
