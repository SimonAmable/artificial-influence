import { spawn } from "node:child_process"

import { fal } from "@fal-ai/client"
import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { checkUserHasCredits, deductUserCredits } from "@/lib/credits"
import { mediaIdStringSchema } from "@/lib/chat/media-id"
import { resolveThreadMediaRowsForTimelineCompose } from "@/lib/chat/thread-media/server"
import { createMissingFfmpegMessage, resolveFfprobeBinaryPath } from "@/lib/server/ffmpeg-binaries"
import { COMPOSITION_ASPECT_PRESETS } from "@/lib/video-editor/composition-presets"

const COMPOSE_TIMELINE_CREDITS = 2
const MAX_SEGMENTS = 15
const MAX_AUDIO_SEGMENTS = 8
const MAX_OUTPUT_DURATION_SEC = 120
const DEFAULT_IMAGE_DURATION_SEC = 3
const DEFAULT_GIF_DURATION_SEC = 10

const FAL_COMPOSE_ENDPOINT = "fal-ai/ffmpeg-api/compose"
const FAL_LOUDNORM_ENDPOINT = "fal-ai/ffmpeg-api/loudnorm"
const FAL_METADATA_ENDPOINT = "fal-ai/ffmpeg-api/metadata"
const FAL_MERGE_AUDIOS_ENDPOINT = "fal-ai/ffmpeg-api/merge-audios"
const FAL_MERGE_AUDIO_VIDEO_ENDPOINT = "fal-ai/ffmpeg-api/merge-audio-video"
const FAL_SCALE_VIDEO_ENDPOINT = "fal-ai/workflow-utilities/scale-video"
const FAL_TRIM_VIDEO_ENDPOINT = "fal-ai/workflow-utilities/trim-video"

type MediaRow = {
  id: string
  mime_type: string
  public_url: string
  label: string | null
}

type MediaKind = "static_image" | "gif" | "video" | "audio"

type ResolvedVisualSegment = {
  durationSec: number
  id: string
  kind: "image" | "video"
  label: string | null
  url: string
}

type ResolvedAudioSegment = {
  durationSec: number
  id: string
  label: string | null
  sourceDurationSec: number | null
  startAtSec: number
  url: string
}

type ComposeTrack = {
  id: string
  keyframes: Array<{
    duration: number
    timestamp: number
    url: string
  }>
  type: "audio" | "image" | "video"
}

type FalMetadataMedia = {
  audio?: unknown
  duration?: number
  fps?: number
  media_type?: string
  resolution?: {
    height?: number
    width?: number
  }
}

function configureFal() {
  const key = process.env.FAL_KEY
  if (!key) {
    throw new Error("FAL_KEY is not configured.")
  }

  fal.config({ credentials: key })
}

async function callFal<Input extends Record<string, unknown>, Output>(
  endpointId: string,
  input: Input,
): Promise<Output> {
  configureFal()

  const result = await fal.subscribe(endpointId as never, {
    input: input as never,
    logs: false,
    mode: "polling",
    pollInterval: 750,
  })

  return result.data as Output
}

function classifyMedia(mime: string): MediaKind {
  const normalized = mime.toLowerCase()
  if (normalized === "image/gif") return "gif"
  if (normalized.startsWith("video/")) return "video"
  if (normalized.startsWith("audio/")) return "audio"
  if (normalized.startsWith("image/")) return "static_image"
  throw new Error(`Unsupported media type for timeline composition: ${mime}`)
}

function ensureFinitePositiveSeconds(value: number, message: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(message)
  }
}

function clampToMaxDuration(seconds: number, message: string) {
  ensureFinitePositiveSeconds(seconds, message)
  if (seconds > MAX_OUTPUT_DURATION_SEC) {
    throw new Error(`A segment exceeds the maximum allowed duration of ${MAX_OUTPUT_DURATION_SEC} seconds.`)
  }
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
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

function ensureNonNegativeFinite(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`)
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
        reject(new Error(Buffer.concat(errChunks).toString("utf8") || `Process exited with code ${code}`))
      }
    })
  })
}

async function fetchMediaMetadata(url: string): Promise<FalMetadataMedia> {
  const result = await callFal<{ extract_frames?: boolean; media_url: string }, { media?: FalMetadataMedia }>(
    FAL_METADATA_ENDPOINT,
    {
      media_url: url,
      extract_frames: false,
    },
  )

  if (!result.media) {
    throw new Error("Fal metadata did not return media details.")
  }

  return result.media
}

async function probeDurationSecondsWithFfprobe(url: string): Promise<number | null> {
  const ffprobePath = resolveFfprobeBinaryPath()
  if (!ffprobePath) {
    return null
  }

  try {
    const formatDurationOutput = await runCapture(ffprobePath, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      url,
    ])
    const formatDuration = parseFirstFiniteNumber(formatDurationOutput)
    if (formatDuration) {
      return formatDuration
    }

    const streamDurationOutput = await runCapture(ffprobePath, [
      "-v",
      "error",
      "-show_entries",
      "stream=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      url,
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
      url,
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
  } catch {
    return null
  }

  return null
}

async function resolveDurationSeconds(url: string): Promise<number | null> {
  try {
    const metadata = await fetchMediaMetadata(url)
    const falDuration = readFiniteNumber(metadata.duration)
    if (falDuration) {
      return falDuration
    }
  } catch {
    // Fall through to ffprobe so one Fal metadata miss does not break composition.
  }

  return probeDurationSecondsWithFfprobe(url)
}

async function trimVideoSource(url: string, startTime: number, endTime: number): Promise<string> {
  const result = await callFal<
    { end_time: number; start_time: number; video_url: string },
    { video?: { url?: string } }
  >(FAL_TRIM_VIDEO_ENDPOINT, {
    video_url: url,
    start_time: startTime,
    end_time: endTime,
  })

  const trimmedUrl = result.video?.url
  if (!trimmedUrl) {
    throw new Error("Fal trim-video did not return a trimmed video URL.")
  }

  return trimmedUrl
}

async function scaleVideoToPreset(url: string, width: number, height: number): Promise<string> {
  const result = await callFal<
    {
      codec: "libx264"
      crf: number
      height: number
      mode: "crop"
      preset: "fast"
      video_url: string
      width: number
    },
    { video?: { url?: string } }
  >(FAL_SCALE_VIDEO_ENDPOINT, {
    video_url: url,
    width,
    height,
    mode: "crop",
    codec: "libx264",
    preset: "fast",
    crf: 18,
  })

  const scaledUrl = result.video?.url
  if (!scaledUrl) {
    throw new Error("Fal scale-video did not return a scaled video URL.")
  }

  return scaledUrl
}

async function mergeAudioUrls(audioUrls: string[]): Promise<string> {
  const result = await callFal<
    {
      audio_urls: string[]
      output_format: "mp3_44100_128"
    },
    { audio?: { url?: string } }
  >(FAL_MERGE_AUDIOS_ENDPOINT, {
    audio_urls: audioUrls,
    output_format: "mp3_44100_128",
  })

  const mergedAudioUrl = result.audio?.url
  if (!mergedAudioUrl) {
    throw new Error("Fal merge-audios did not return an audio URL.")
  }

  return mergedAudioUrl
}

async function normalizeAudioUrl(audioUrl: string): Promise<string> {
  const result = await callFal<
    {
      audio_url: string
      integrated_loudness: number
      loudness_range: number
      print_summary: boolean
      true_peak: number
    },
    { audio?: { url?: string } }
  >(FAL_LOUDNORM_ENDPOINT, {
    audio_url: audioUrl,
    integrated_loudness: -18,
    true_peak: -0.1,
    loudness_range: 7,
    print_summary: false,
  })

  const normalizedAudioUrl = result.audio?.url
  if (!normalizedAudioUrl) {
    throw new Error("Fal loudnorm did not return a normalized audio URL.")
  }

  return normalizedAudioUrl
}

async function mergeAudioOntoVideo(videoUrl: string, audioUrl: string, startOffsetSec: number): Promise<string> {
  const result = await callFal<
    {
      audio_url: string
      start_offset?: number
      video_url: string
    },
    { video?: { url?: string } }
  >(FAL_MERGE_AUDIO_VIDEO_ENDPOINT, {
    video_url: videoUrl,
    audio_url: audioUrl,
    ...(startOffsetSec > 0 ? { start_offset: startOffsetSec } : {}),
  })

  const mergedVideoUrl = result.video?.url
  if (!mergedVideoUrl) {
    throw new Error("Fal merge-audio-video did not return a video URL.")
  }

  return mergedVideoUrl
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Failed to download composed video from Fal (${response.status}).`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  if (buffer.byteLength <= 0) {
    throw new Error("Fal returned an empty composed video file.")
  }

  return buffer
}

function secondsToMs(seconds: number) {
  return Math.round(seconds * 1000)
}

interface CreateComposeTimelineVideoToolOptions {
  supabase: SupabaseClient
  threadId?: string
  userId: string
}

const OUTPUT_PRESET_IDS = COMPOSITION_ASPECT_PRESETS.map((preset) => preset.id) as [string, ...string[]]

export function createComposeTimelineVideoTool({
  supabase,
  threadId,
  userId,
}: CreateComposeTimelineVideoToolOptions) {
  return tool({
    description:
      "Assemble existing thread media into one MP4 using Fal FFmpeg APIs. Use **listThreadMedia** first to get `mediaIds`. Visual **segments** are placed sequentially in timeline order and can use **images** (PNG/JPEG/WebP), **GIFs**, and **videos** (MP4/WebM/MOV). Set **durationSeconds** on images/GIFs to control pacing; use **trimStartSeconds** / **trimEndSeconds** on video segments to cut dead air and choose exact moments. Under the hood, the tool groups visual segments onto the supported Fal track layout instead of creating one video track per segment. Optional **audioSegments** can add soundtrack or voiceover items (audio files, or video files whose audio should be reused). The most reliable Fal path today is **one full-length soundtrack/voiceover track** with optional **startAtSeconds**. Multiple full-length audio files can also be chained when they all start at 0. Set **normalizeAudio** when the attached music or voiceover should be leveled for more consistent loudness before being merged. Choose **outputPreset** for the final canvas size such as 9:16-1080 or 16:9-1080. The final MP4 is uploaded back to thread media for reuse.",
    inputSchema: z.object({
      segments: z
        .array(
          z.object({
            mediaId: mediaIdStringSchema.describe(
              "Image, GIF, or video media id from listThreadMedia, in the exact visual order you want on screen.",
            ),
            durationSeconds: z
              .number()
              .min(0.5)
              .max(60)
              .optional()
              .describe(
                "For static images and GIFs: how long to hold this segment on screen. Ignored for videos unless trimEndSeconds is omitted and you want to shorten the clip from the front.",
              ),
            trimStartSeconds: z
              .number()
              .min(0)
              .optional()
              .describe("For video segments only: start time within the source file in seconds."),
            trimEndSeconds: z
              .number()
              .min(0)
              .optional()
              .describe("For video segments only: end time within the source file in seconds."),
          }),
        )
        .min(1)
        .max(MAX_SEGMENTS)
        .describe(
          "Visual timeline in order. Use shorter image holds for punchy edits, longer holds for reading time, and video trims to keep only the useful moment.",
        ),
      audioSegments: z
        .array(
          z.object({
            mediaId: mediaIdStringSchema.describe(
              "Optional audio or video media id from listThreadMedia to use as soundtrack or voiceover.",
            ),
            startAtSeconds: z
              .number()
              .min(0)
              .optional()
              .describe("When this audio should begin on the final timeline (default 0)."),
            durationSeconds: z
              .number()
              .min(0.5)
              .max(120)
              .optional()
              .describe(
                "Optional playback length starting from the beginning of the source audio. Best-effort only: the stable Fal audio merge path is most reliable when you use the full source track.",
              ),
          }),
        )
        .max(MAX_AUDIO_SEGMENTS)
        .optional()
        .describe(
          "Optional soundtrack or voiceover layers. Add none for a visuals-only edit. Most reliable: one soundtrack/voiceover track with an optional start offset. Multiple tracks currently work best only when they all start at 0 and are used full-length in order.",
        ),
      outputPreset: z
        .enum(OUTPUT_PRESET_IDS)
        .describe("Canvas size: e.g. 16:9-1080, 9:16-1080, 16:9-720."),
      normalizeAudio: z
        .boolean()
        .optional()
        .describe(
          "When true, normalize the merged soundtrack/voiceover loudness with Fal loudnorm before attaching it to the final video.",
        ),
      fps: z
        .number()
        .int()
        .min(12)
        .max(60)
        .optional()
        .describe(
          "Legacy compatibility hint. Fal determines render FPS internally; the returned result reports the actual final FPS.",
        ),
    }),
    execute: async ({ segments, audioSegments = [], outputPreset, normalizeAudio = false }) => {
      if (!threadId) {
        throw new Error("Timeline composition requires a persisted chat thread (threadId).")
      }

      const hasCredits = await checkUserHasCredits(userId, COMPOSE_TIMELINE_CREDITS, supabase)
      if (!hasCredits) {
        throw new Error(`Insufficient credits. Composing a timeline requires ${COMPOSE_TIMELINE_CREDITS} credits.`)
      }

      const preset = COMPOSITION_ASPECT_PRESETS.find((entry) => entry.id === outputPreset)
      if (!preset) {
        throw new Error(`Unknown output preset: ${outputPreset}`)
      }

      const uniqueMediaIds = [
        ...new Set([
          ...segments.map((segment) => segment.mediaId),
          ...audioSegments.map((segment) => segment.mediaId),
        ]),
      ]
      const rows = await resolveThreadMediaRowsForTimelineCompose(supabase, userId, threadId, uniqueMediaIds)
      const rowMap = new Map(rows.map((row) => [row.id, row] as const))

      const resolveRow = (mediaId: string): MediaRow => {
        const row = rowMap.get(mediaId)
        if (!row) {
          throw new Error(`Media id ${mediaId} could not be resolved for composition.`)
        }
        return row
      }

      const durationCache = new Map<string, Promise<number | null>>()
      const getDurationSeconds = (url: string) => {
        let promise = durationCache.get(url)
        if (!promise) {
          promise = resolveDurationSeconds(url)
          durationCache.set(url, promise)
        }
        return promise
      }

      const resolvedVisuals: ResolvedVisualSegment[] = []
      let visualTimelineDurationSec = 0

      for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index]!
        const row = resolveRow(segment.mediaId)
        const kind = classifyMedia(row.mime_type)

        if (kind === "audio") {
          throw new Error(`Media ${segment.mediaId} is audio-only. Use it in audioSegments, not segments.`)
        }

        if (kind === "static_image") {
          const durationSec = segment.durationSeconds ?? DEFAULT_IMAGE_DURATION_SEC
          clampToMaxDuration(durationSec, "Static image duration must be a positive number.")
          resolvedVisuals.push({
            id: row.id,
            kind: "image",
            label: row.label,
            url: row.public_url,
            durationSec,
          })
          visualTimelineDurationSec += durationSec
          continue
        }

        if (kind === "gif") {
          const durationSec = segment.durationSeconds ?? DEFAULT_GIF_DURATION_SEC
          clampToMaxDuration(durationSec, "GIF duration must be a positive number.")
          resolvedVisuals.push({
            id: row.id,
            kind: "video",
            label: row.label,
            url: row.public_url,
            durationSec,
          })
          visualTimelineDurationSec += durationSec
          continue
        }

        const trimStartSec = segment.trimStartSeconds ?? 0
        ensureNonNegativeFinite(trimStartSec, "trimStartSeconds")

        const fullDurationSec = await getDurationSeconds(row.public_url)
        const explicitDurationSec = segment.durationSeconds
        let trimEndSec = segment.trimEndSeconds

        if (trimEndSec == null && explicitDurationSec != null) {
          trimEndSec = trimStartSec + explicitDurationSec
        }
        if (trimEndSec == null && fullDurationSec != null) {
          trimEndSec = fullDurationSec
        }
        if (trimEndSec == null) {
          const ffprobePath = resolveFfprobeBinaryPath()
          const ffprobeHint = ffprobePath ? "" : ` ${createMissingFfmpegMessage()}`
          throw new Error(
            `Could not read video duration for ${segment.mediaId}. Provide durationSeconds or trimEndSeconds for that segment, or retry with a more standard MP4/MOV/WebM file.${ffprobeHint}`,
          )
        }

        ensureNonNegativeFinite(trimEndSec, "trimEndSeconds")
        if (fullDurationSec != null && trimEndSec > fullDurationSec) {
          trimEndSec = fullDurationSec
        }
        if (trimEndSec <= trimStartSec) {
          throw new Error("trimEndSeconds must be greater than trimStartSeconds for video segments.")
        }

        const durationSec = trimEndSec - trimStartSec
        clampToMaxDuration(durationSec, "Video segment duration must be a positive number.")

        const trimmedUrl =
          trimStartSec > 0 || (fullDurationSec != null && trimEndSec < fullDurationSec)
            ? await trimVideoSource(row.public_url, trimStartSec, trimEndSec)
            : row.public_url

        resolvedVisuals.push({
          id: row.id,
          kind: "video",
          label: row.label,
          url: trimmedUrl,
          durationSec,
        })
        visualTimelineDurationSec += durationSec
      }

      if (visualTimelineDurationSec <= 0) {
        throw new Error("The visual timeline is empty.")
      }

      if (visualTimelineDurationSec > MAX_OUTPUT_DURATION_SEC) {
        throw new Error(
          `Output duration ${visualTimelineDurationSec.toFixed(1)}s exceeds the maximum of ${MAX_OUTPUT_DURATION_SEC}s.`,
        )
      }

      const resolvedAudios: ResolvedAudioSegment[] = []

      for (let index = 0; index < audioSegments.length; index += 1) {
        const segment = audioSegments[index]!
        const row = resolveRow(segment.mediaId)
        const kind = classifyMedia(row.mime_type)

        if (kind !== "audio" && kind !== "video") {
          throw new Error(
            `Media ${segment.mediaId} is not audio-capable (${row.mime_type}). Use audio files or videos in audioSegments.`,
          )
        }

        const startAtSec = segment.startAtSeconds ?? 0
        ensureNonNegativeFinite(startAtSec, "startAtSeconds")
        if (startAtSec >= visualTimelineDurationSec) {
          throw new Error(
            `Audio segment ${segment.mediaId} starts at ${startAtSec}s, which is beyond the end of the visual timeline.`,
          )
        }

        const remainingTimelineSec = visualTimelineDurationSec - startAtSec
        const sourceDurationSec = await getDurationSeconds(row.public_url)
        const requestedDurationSec = segment.durationSeconds ?? sourceDurationSec
        if (requestedDurationSec == null) {
          const ffprobePath = resolveFfprobeBinaryPath()
          const ffprobeHint = ffprobePath ? "" : ` ${createMissingFfmpegMessage()}`
          throw new Error(
            `Could not read audio duration for ${segment.mediaId}. Provide durationSeconds for that audio segment, or retry with a more standard audio/video file.${ffprobeHint}`,
          )
        }
        clampToMaxDuration(requestedDurationSec, "Audio segment duration must be a positive number.")

        const durationSec =
          sourceDurationSec != null
            ? Math.min(requestedDurationSec, sourceDurationSec, remainingTimelineSec)
            : Math.min(requestedDurationSec, remainingTimelineSec)
        ensureFinitePositiveSeconds(durationSec, "Audio segment duration must be greater than zero.")

        resolvedAudios.push({
          id: row.id,
          label: row.label,
          sourceDurationSec,
          startAtSec,
          url: row.public_url,
          durationSec,
        })
      }

      const imageTrackKeyframes: ComposeTrack["keyframes"] = []
      const videoTrackKeyframes: ComposeTrack["keyframes"] = []
      let cursorSec = 0

      for (let index = 0; index < resolvedVisuals.length; index += 1) {
        const segment = resolvedVisuals[index]!
        const keyframe = {
          timestamp: secondsToMs(cursorSec),
          duration: secondsToMs(segment.durationSec),
          url: segment.url,
        }
        if (segment.kind === "image") {
          imageTrackKeyframes.push(keyframe)
        } else {
          videoTrackKeyframes.push(keyframe)
        }
        cursorSec += segment.durationSec
      }

      const visualTracks: ComposeTrack[] = []
      if (imageTrackKeyframes.length > 0) {
        visualTracks.push({
          id: "image-track-main",
          type: "image",
          keyframes: imageTrackKeyframes,
        })
      }
      if (videoTrackKeyframes.length > 0) {
        visualTracks.push({
          id: "video-track-main",
          type: "video",
          keyframes: videoTrackKeyframes,
        })
      }

      if (visualTracks.length === 0) {
        throw new Error("No visual composition tracks were produced.")
      }

      const composed = await callFal<{ tracks: ComposeTrack[] }, { thumbnail_url?: string; video_url?: string }>(
        FAL_COMPOSE_ENDPOINT,
        { tracks: visualTracks },
      )

      const composedUrl = composed.video_url
      if (!composedUrl) {
        throw new Error("Fal compose did not return a video URL.")
      }

      const scaledVisualUrl = await scaleVideoToPreset(composedUrl, preset.width, preset.height)

      let finalVideoUrl = scaledVisualUrl
      if (resolvedAudios.length === 1) {
        const audio = resolvedAudios[0]!
        if (
          audio.sourceDurationSec != null &&
          audio.durationSec < audio.sourceDurationSec - 0.25
        ) {
          throw new Error(
            "This audio placement needs partial-duration mixing, but Fal's stable merge-audio-video endpoint only supports attaching one full audio source with an optional start offset right now.",
          )
        }
        const audioUrl = normalizeAudio ? await normalizeAudioUrl(audio.url) : audio.url
        finalVideoUrl = await mergeAudioOntoVideo(scaledVisualUrl, audioUrl, audio.startAtSec)
      } else if (resolvedAudios.length > 1) {
        const allStartAtZero = resolvedAudios.every((segment) => segment.startAtSec === 0)
        const allUseFullSource = resolvedAudios.every(
          (segment) =>
            segment.sourceDurationSec == null || segment.durationSec >= segment.sourceDurationSec - 0.25,
        )
        if (!allStartAtZero || !allUseFullSource) {
          throw new Error(
            "Multiple audio segments with independent offsets or partial durations are not yet supported on the stable Fal merge path. Use one soundtrack/voiceover track for now, or I can extend this with a different mixing strategy next.",
          )
        }
        const mergedAudioUrl = await mergeAudioUrls(resolvedAudios.map((segment) => segment.url))
        const audioUrl = normalizeAudio ? await normalizeAudioUrl(mergedAudioUrl) : mergedAudioUrl
        finalVideoUrl = await mergeAudioOntoVideo(scaledVisualUrl, audioUrl, 0)
      }

      const outputBuffer = await downloadBuffer(finalVideoUrl)
      const finalMetadata = await fetchMediaMetadata(finalVideoUrl)

      const finalDurationSec = readFiniteNumber(finalMetadata.duration) ?? visualTimelineDurationSec
      if (finalDurationSec > MAX_OUTPUT_DURATION_SEC + 1) {
        throw new Error(`Output duration ${finalDurationSec.toFixed(1)}s exceeds the maximum.`)
      }

      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).slice(2, 10)
      const storagePath = `${userId}/chat-compose-timeline/${timestamp}-${randomStr}.mp4`
      const { error: uploadError } = await supabase.storage.from("public-bucket").upload(storagePath, outputBuffer, {
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
        duration_seconds: finalDurationSec,
      })

      if (insertError && insertError.code !== "23505") {
        console.error("[composeTimelineVideo] uploads insert failed:", insertError.message)
      }

      const finalWidth = readFiniteNumber(finalMetadata.resolution?.width) ?? preset.width
      const finalHeight = readFiniteNumber(finalMetadata.resolution?.height) ?? preset.height
      const finalFps = readFiniteNumber(finalMetadata.fps) ?? null
      const hasAudio = resolvedAudios.length > 0 || Boolean(finalMetadata.audio)

      return {
        status: "completed" as const,
        message:
          resolvedAudios.length > 0
            ? `Composed ${segments.length} visual segment(s) with ${resolvedAudios.length} audio segment(s) into one ${preset.label} video.`
            : `Composed ${segments.length} visual segment(s) into one ${preset.label} video.`,
        creditsUsed: COMPOSE_TIMELINE_CREDITS,
        outputPreset,
        width: finalWidth,
        height: finalHeight,
        fps: finalFps,
        videoDurationSec: finalDurationSec,
        segmentCount: segments.length,
        audioSegmentCount: resolvedAudios.length,
        hasAudio,
        thumbnailUrl: composed.thumbnail_url ?? null,
        video: {
          mimeType: "video/mp4",
          url: publicUrl,
          storagePath,
        },
      }
    },
  })
}
