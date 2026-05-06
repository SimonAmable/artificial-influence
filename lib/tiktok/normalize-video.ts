import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  createMissingFfmpegMessage,
  resolveFfmpegBinaryPath,
} from "@/lib/server/ffmpeg-binaries"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

const TIKTOK_NORMALIZATION_VERSION = "tiktok-h264-aac-v1"
const MAX_TIKTOK_INPUT_BYTES = 250 * 1024 * 1024
const PUBLIC_BUCKET = "public-bucket"

export const TIKTOK_COMPATIBLE_MIME_TYPE = "video/mp4"
export const TIKTOK_COMPATIBILITY_PROFILE = "MP4, H.264, AAC, yuv420p, faststart"

type NormalizeTikTokVideoResult = {
  buffer: Buffer
  fileName: string
  mimeType: typeof TIKTOK_COMPATIBLE_MIME_TYPE
  profile: typeof TIKTOK_COMPATIBILITY_PROFILE
  sourceHash: string
}

type NormalizeTikTokVideoUploadResult = {
  publicUrl: string
  storagePath: string
  fileName: string
  mimeType: typeof TIKTOK_COMPATIBLE_MIME_TYPE
  profile: typeof TIKTOK_COMPATIBILITY_PROFILE
  sizeBytes: number
  reused: boolean
}

function sanitizeTikTokOutputFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "").trim() || "video"
  return `${baseName}-tiktok.mp4`
}

function buildStoragePath(userId: string, sourceHash: string) {
  return `${userId}/autopost/tiktok-compatible/${sourceHash}-${TIKTOK_NORMALIZATION_VERSION}.mp4`
}

function bufferFromBytes(bytes: ArrayBuffer | Buffer) {
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
}

function runFfmpeg(ffmpegPath: string, args: string[], cwd?: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true, cwd })
    const errChunks: Buffer[] = []

    child.stderr?.on("data", (chunk) => errChunks.push(Buffer.from(chunk)))
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(errChunks).toString("utf8"))
        return
      }

      const stderr = Buffer.concat(errChunks).toString("utf8").trim()
      reject(new Error(stderr || `ffmpeg exited with code ${code}`))
    })
  })
}

async function readSourceBufferFromUrl(mediaUrl: string) {
  const response = await fetch(mediaUrl, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Could not download the source video (${response.status}).`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  if (buffer.byteLength <= 0) {
    throw new Error("The source video is empty.")
  }
  if (buffer.byteLength > MAX_TIKTOK_INPUT_BYTES) {
    throw new Error("The source video is too large to normalize for TikTok.")
  }

  return buffer
}

export async function normalizeTikTokVideoBuffer(input: {
  bytes: ArrayBuffer | Buffer
  fileName: string
}): Promise<NormalizeTikTokVideoResult> {
  const ffmpegPath = resolveFfmpegBinaryPath()
  if (!ffmpegPath) {
    throw new Error(createMissingFfmpegMessage())
  }

  const sourceBuffer = bufferFromBytes(input.bytes)
  if (sourceBuffer.byteLength <= 0) {
    throw new Error("No video data was provided.")
  }
  if (sourceBuffer.byteLength > MAX_TIKTOK_INPUT_BYTES) {
    throw new Error("This video is too large for the TikTok compatibility converter.")
  }

  const sourceHash = createHash("sha256").update(sourceBuffer).digest("hex")
  const tempDir = await mkdtemp(join(tmpdir(), "tiktok-normalize-"))
  const inputPath = join(tempDir, "input-video")
  const outputPath = join(tempDir, sanitizeTikTokOutputFileName(input.fileName))

  try {
    await writeFile(inputPath, sourceBuffer)

    await runFfmpeg(ffmpegPath, [
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-vf",
      "scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p",
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "21",
      "-profile:v",
      "high",
      "-level",
      "4.1",
      "-pix_fmt",
      "yuv420p",
      "-maxrate",
      "8M",
      "-bufsize",
      "16M",
      "-movflags",
      "+faststart",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ar",
      "48000",
      "-ac",
      "2",
      outputPath,
    ], tempDir)

    const outputBuffer = await readFile(outputPath)
    if (outputBuffer.byteLength <= 0) {
      throw new Error("FFmpeg did not produce a TikTok-compatible output file.")
    }

    return {
      buffer: outputBuffer,
      fileName: sanitizeTikTokOutputFileName(input.fileName),
      mimeType: TIKTOK_COMPATIBLE_MIME_TYPE,
      profile: TIKTOK_COMPATIBILITY_PROFILE,
      sourceHash,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown FFmpeg error."
    throw new Error(`TikTok compatibility conversion failed: ${message}`)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export async function normalizeTikTokVideoUrlToStorage(input: {
  mediaUrl: string
  userId: string
  supabase: SupabaseClient
  fileName?: string
}): Promise<NormalizeTikTokVideoUploadResult> {
  const sourceBuffer = await readSourceBufferFromUrl(input.mediaUrl)
  const normalized = await normalizeTikTokVideoBuffer({
    bytes: sourceBuffer,
    fileName: input.fileName ?? "video.mp4",
  })

  const storagePath = buildStoragePath(input.userId, normalized.sourceHash)
  const storageClient = createServiceRoleClient() ?? input.supabase
  const bucket = storageClient.storage.from(PUBLIC_BUCKET)
  const existing = await bucket.exists(storagePath)
  const alreadyExists = !existing.error && Boolean(existing.data)

  if (!alreadyExists) {
    const upload = await bucket.upload(storagePath, normalized.buffer, {
      contentType: normalized.mimeType,
      upsert: false,
    })
    if (upload.error) {
      throw new Error(`Could not upload the normalized TikTok video: ${upload.error.message}`)
    }
  }

  const publicUrl = bucket.getPublicUrl(storagePath).data.publicUrl

  return {
    publicUrl,
    storagePath,
    fileName: normalized.fileName,
    mimeType: normalized.mimeType,
    profile: normalized.profile,
    sizeBytes: normalized.buffer.byteLength,
    reused: alreadyExists,
  }
}
