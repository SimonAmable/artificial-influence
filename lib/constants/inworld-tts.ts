export const INWORLD_TTS_MODEL_OPTIONS = [
  {
    id: "inworld-tts-1.5-max",
    label: "Inworld 1.5 Max",
    description: "Flagship quality and speed with enhanced timestamps",
    group: "Current",
    deprecated: false,
  },
  {
    id: "inworld-tts-1.5-mini",
    label: "Inworld 1.5 Mini",
    description: "Lowest latency and most cost-efficient option",
    group: "Current",
    deprecated: false,
  },
  {
    id: "inworld-tts-1-max",
    label: "Inworld 1 Max",
    description: "Previous generation high-quality model with basic timestamps",
    group: "Legacy",
    deprecated: true,
  },
  {
    id: "inworld-tts-1",
    label: "Inworld 1",
    description: "Previous generation fast model with basic timestamps",
    group: "Legacy",
    deprecated: true,
  },
] as const

export type InworldTtsModelId =
  (typeof INWORLD_TTS_MODEL_OPTIONS)[number]["id"]

export const DEFAULT_INWORLD_TTS_MODEL: InworldTtsModelId =
  "inworld-tts-1.5-max"

export const DEFAULT_INWORLD_VOICE_ID = "Alex"
export const DEFAULT_INWORLD_VOICE_NAME = "Alex"

export interface InworldVoice {
  voiceId: string
  displayName: string
  description: string
  langCode: string
  tags: string[]
  source: string
  name?: string
  provider?: string
  providerVoiceId?: string
  model?: string | null
  previewText?: string
  previewAudioUrl?: string
}

export function isInworldTtsModelId(value: string): value is InworldTtsModelId {
  return INWORLD_TTS_MODEL_OPTIONS.some((model) => model.id === value)
}

export function getInworldTtsModelOption(modelId?: string | null) {
  return INWORLD_TTS_MODEL_OPTIONS.find((model) => model.id === modelId)
}

export function getInworldVoiceSourceLabel(source: string) {
  switch (source) {
    case "SYSTEM":
      return "Built-in"
    case "IVC":
      return "Cloned"
    case "PVC":
      return "Pro Clone"
    default:
      return source
  }
}

export function formatInworldLangCode(langCode: string) {
  return langCode.replace(/_/g, "-")
}

export function getInworldVoiceSearchText(voice: InworldVoice) {
  return [
    voice.displayName,
    voice.voiceId,
    voice.description,
    voice.langCode,
    voice.source,
    voice.name,
    voice.provider,
    voice.model,
    ...voice.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}
