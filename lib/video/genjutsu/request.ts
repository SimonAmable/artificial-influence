import { MODEL_IDENTIFIERS } from "@/lib/constants/models"
import { buildCatalogFalVideoRequest } from "@/lib/server/fal-video-catalog"
import { GENJUTSU_MAX_REFERENCE_IMAGES } from "./constants"
import { resolveGenjutsuDuration } from "./duration"

export function buildGenjutsuFalRequest(options: {
  durationSeconds: number
  prompt: string
  referenceImageUrls: string[]
  referenceVideoUrl: string
}) {
  const images = [...new Set(options.referenceImageUrls.map((url) => url.trim()).filter(Boolean))].slice(
    0,
    GENJUTSU_MAX_REFERENCE_IMAGES,
  )
  if (images.length === 0) {
    throw new Error("Add a character image.")
  }
  const videoUrl = options.referenceVideoUrl.trim()
  if (!videoUrl) {
    throw new Error("Add a video.")
  }

  return buildCatalogFalVideoRequest({
    aspectRatio: "adaptive",
    duration: resolveGenjutsuDuration(options.durationSeconds),
    enablePromptExpansion: false,
    generateAudio: false,
    modelIdentifier: MODEL_IDENTIFIERS.WAN_30,
    prompt: options.prompt,
    referenceImageUrls: images,
    referenceVideoUrls: [videoUrl],
    resolution: "720p",
    videoUrl,
  })
}
