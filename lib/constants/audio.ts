import {
  INWORLD_TTS_MODEL_OPTIONS,
  DEFAULT_INWORLD_TTS_MODEL,
  DEFAULT_INWORLD_VOICE_ID,
  DEFAULT_INWORLD_VOICE_NAME,
} from "@/lib/constants/inworld-tts"

export type AudioProvider = "inworld" | "google"

export interface AudioVoice {
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

export const AUDIO_PROVIDER_OPTIONS = [
  { id: "inworld", label: "Inworld" },
  { id: "google", label: "Gemini" },
] as const

export const DEFAULT_AUDIO_PROVIDER: AudioProvider = "inworld"

export const GOOGLE_GEMINI_TTS_MODEL = "google/gemini-3.1-flash-tts" as const
export const GOOGLE_GEMINI_TTS_MODEL_LABEL = "Gemini 3.1" as const
export const DEFAULT_GOOGLE_GEMINI_VOICE_ID = "Kore" as const
export const DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE = "en-US" as const
export const DEFAULT_GOOGLE_GEMINI_STYLE_PROMPT =
  "Say the following." as const

export const AUDIO_MODEL_OPTIONS = [
  {
    id: GOOGLE_GEMINI_TTS_MODEL,
    label: GOOGLE_GEMINI_TTS_MODEL_LABEL,
    description: "Google Gemini speech generation with style prompts and inline delivery tags.",
    group: "Current",
    provider: "google",
    deprecated: false,
  },
  ...INWORLD_TTS_MODEL_OPTIONS.map((option) => ({
    ...option,
    provider: "inworld" as const,
  })),
] as const

type GoogleGeminiVoiceSeed = {
  voiceId: string
  gender: "Male" | "Female"
  character: string
}

export const GOOGLE_GEMINI_TTS_VOICES: readonly GoogleGeminiVoiceSeed[] = [
  { voiceId: "Zephyr", gender: "Female", character: "Bright" },
  { voiceId: "Puck", gender: "Male", character: "Upbeat" },
  { voiceId: "Charon", gender: "Male", character: "Informative" },
  { voiceId: "Kore", gender: "Female", character: "Firm" },
  { voiceId: "Fenrir", gender: "Male", character: "Excitable" },
  { voiceId: "Leda", gender: "Female", character: "Youthful" },
  { voiceId: "Orus", gender: "Male", character: "Firm" },
  { voiceId: "Aoede", gender: "Female", character: "Breezy" },
  { voiceId: "Callirrhoe", gender: "Female", character: "Easy-going" },
  { voiceId: "Autonoe", gender: "Female", character: "Bright" },
  { voiceId: "Enceladus", gender: "Male", character: "Breathy" },
  { voiceId: "Iapetus", gender: "Male", character: "Clear" },
  { voiceId: "Umbriel", gender: "Male", character: "Easy-going" },
  { voiceId: "Algenib", gender: "Male", character: "Gravelly" },
  { voiceId: "Despina", gender: "Female", character: "Smooth" },
  { voiceId: "Erinome", gender: "Female", character: "Clear" },
  { voiceId: "Laomedeia", gender: "Female", character: "Upbeat" },
  { voiceId: "Achernar", gender: "Female", character: "Soft" },
  { voiceId: "Algieba", gender: "Male", character: "Smooth" },
  { voiceId: "Schedar", gender: "Male", character: "Even" },
  { voiceId: "Gacrux", gender: "Female", character: "Mature" },
  { voiceId: "Pulcherrima", gender: "Female", character: "Forward" },
  { voiceId: "Achird", gender: "Male", character: "Friendly" },
  { voiceId: "Zubenelgenubi", gender: "Male", character: "Casual" },
  { voiceId: "Vindemiatrix", gender: "Female", character: "Gentle" },
  { voiceId: "Sadachbia", gender: "Male", character: "Lively" },
  { voiceId: "Sadaltager", gender: "Male", character: "Knowledgeable" },
  { voiceId: "Sulafat", gender: "Female", character: "Warm" },
  { voiceId: "Alnilam", gender: "Male", character: "Firm" },
  { voiceId: "Rasalgethi", gender: "Male", character: "Informative" },
] as const

export function getAudioProviderLabel(provider: AudioProvider | string) {
  return (
    AUDIO_PROVIDER_OPTIONS.find((option) => option.id === provider)?.label ??
    provider
  )
}

export function getDefaultAudioVoiceId(provider: AudioProvider) {
  return provider === "google"
    ? DEFAULT_GOOGLE_GEMINI_VOICE_ID
    : DEFAULT_INWORLD_VOICE_ID
}

export function getDefaultAudioVoiceName(provider: AudioProvider) {
  return provider === "google"
    ? DEFAULT_GOOGLE_GEMINI_VOICE_ID
    : DEFAULT_INWORLD_VOICE_NAME
}

export function getDefaultAudioModel(provider: AudioProvider) {
  return provider === "google"
    ? GOOGLE_GEMINI_TTS_MODEL
    : DEFAULT_INWORLD_TTS_MODEL
}

export function getAudioModelOption(modelId?: string | null) {
  return AUDIO_MODEL_OPTIONS.find((model) => model.id === modelId)
}

export function getAudioProviderForModel(modelId?: string | null): AudioProvider {
  return getAudioModelOption(modelId)?.provider ?? DEFAULT_AUDIO_PROVIDER
}

/** Icon shown next to TTS model options (brand logo for Inworld, Gemini mark for Google). */
export function getAudioModelIconSrc(modelId?: string | null) {
  return getAudioProviderForModel(modelId) === "google"
    ? "/ai_icons/gemini-color.svg"
    : "/logo.svg"
}

export function getAudioModelLabel(modelId?: string | null) {
  return getAudioModelOption(modelId)?.label ?? modelId ?? null
}

export function getAudioVoiceSourceLabel(source: string) {
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

export function formatAudioLangCode(langCode: string) {
  return langCode.replace(/_/g, "-")
}

export function getAudioVoiceSearchText(voice: AudioVoice) {
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

export function buildFallbackGoogleGeminiVoices(): AudioVoice[] {
  return GOOGLE_GEMINI_TTS_VOICES.map((voice) => ({
    voiceId: voice.voiceId,
    displayName: voice.voiceId,
    description: `${voice.gender} voice with a ${voice.character.toLowerCase()} character.`,
    langCode: DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE,
    tags: [voice.gender.toLowerCase(), voice.character.toLowerCase(), "gemini-tts"],
    source: "SYSTEM",
    provider: "google",
    providerVoiceId: voice.voiceId,
    model: GOOGLE_GEMINI_TTS_MODEL,
  }))
}
