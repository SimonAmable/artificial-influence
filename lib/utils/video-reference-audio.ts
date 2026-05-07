export interface VideoReferenceAudioConfig {
  accept: string
  allowedExtensions: string[]
  description: string
  title: string
  validationMessage: string
}

const VIDEO_REFERENCE_AUDIO_CONFIGS: Record<string, VideoReferenceAudioConfig> = {
  "bytedance/seedance-2.0": {
    accept:
      "audio/wav,audio/x-wav,audio/mpeg,audio/mp3,audio/mp4,audio/aac,audio/x-m4a,.wav,.mp3,.m4a,.aac",
    allowedExtensions: ["wav", "mp3", "m4a", "aac"],
    description:
      ".wav / .mp3 / .m4a / .aac (~15s). Use [Audio1] in prompt; needs a frame or reference video.",
    title: "Reference audio",
    validationMessage: "Use a supported audio file (.wav, .mp3, .m4a, or .aac).",
  },
  "prunaai/p-video": {
    accept: "audio/wav,audio/x-wav,audio/mpeg,audio/mp3,.wav,.mp3",
    allowedExtensions: ["wav", "mp3"],
    description: ".wav / .mp3. Conditions motion and timing for P-Video; prompt is still required.",
    title: "Optional audio",
    validationMessage: "P-Video currently supports .wav or .mp3 audio inputs.",
  },
  "wan-video/wan-2.7": {
    accept: "audio/wav,audio/x-wav,audio/mpeg,audio/mp3,.wav,.mp3",
    allowedExtensions: ["wav", "mp3"],
    description: ".wav / .mp3, optional sync audio for Wan 2.7 (3-30s per model docs).",
    title: "Optional audio",
    validationMessage: "Wan 2.7 currently supports .wav or .mp3 audio inputs.",
  },
}

function getLowercaseExtension(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const ext = trimmed.split(".").pop()?.toLowerCase() ?? ""
  return ext.length > 0 ? ext : null
}

function getNormalizedUrlPath(value: string): string {
  try {
    return decodeURIComponent(new URL(value).pathname)
  } catch {
    return value
  }
}

export function getVideoReferenceAudioConfig(modelIdentifier: string): VideoReferenceAudioConfig | null {
  return VIDEO_REFERENCE_AUDIO_CONFIGS[modelIdentifier] ?? null
}

export function isSupportedVideoReferenceAudioFile(
  modelIdentifier: string,
  file: Pick<File, "name" | "type">,
): boolean {
  const config = getVideoReferenceAudioConfig(modelIdentifier)
  if (!config) return file.type.startsWith("audio/")

  const extension = getLowercaseExtension(file.name)
  if (extension && config.allowedExtensions.includes(extension)) return true

  const mime = file.type.toLowerCase()
  if (config.allowedExtensions.includes("mp3") && (mime === "audio/mpeg" || mime === "audio/mp3")) {
    return true
  }
  if (
    config.allowedExtensions.includes("wav") &&
    (mime === "audio/wav" || mime === "audio/x-wav" || mime === "audio/wave")
  ) {
    return true
  }
  if (
    config.allowedExtensions.includes("m4a") &&
    (mime === "audio/mp4" || mime === "audio/x-m4a")
  ) {
    return true
  }
  if (config.allowedExtensions.includes("aac") && mime === "audio/aac") {
    return true
  }

  return false
}

export function isSupportedVideoReferenceAudioUrl(modelIdentifier: string, url: string): boolean {
  const config = getVideoReferenceAudioConfig(modelIdentifier)
  if (!config) return true

  const extension = getLowercaseExtension(getNormalizedUrlPath(url))
  return !extension || config.allowedExtensions.includes(extension)
}
