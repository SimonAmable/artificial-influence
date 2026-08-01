import {
  INWORLD_TTS_MODEL_OPTIONS,
  DEFAULT_INWORLD_TTS_MODEL,
  DEFAULT_INWORLD_VOICE_ID,
  DEFAULT_INWORLD_VOICE_NAME,
} from "@/lib/constants/inworld-tts"

export type AudioProvider = "inworld" | "google" | "qwen" | "fal" | "fish"

export type PrivateVoiceKind = "clone" | "design"

export const AUDIO_GENERATION_CREDIT_COST = 1
export const MAX_AUDIO_SCRIPT_CHARACTERS = 1000
export const MAX_PRIVATE_VOICE_REFERENCE_SECONDS = 15
export const PRIVATE_VOICE_PREVIEW_TEXT =
  "Hello, this is a preview of my voice."
export const PRIVATE_VOICE_PREVIEW_CREDIT_COST = AUDIO_GENERATION_CREDIT_COST

export interface PrivateVoiceConfig {
  baseVoice?: string
  language?: string
  languageCode?: string
  referenceText?: string
  styleInstruction?: string
  stylePrompt?: string
  voiceDescription?: string
  fishVoiceId?: string
}

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
  referenceAudioUrl?: string
  privateVoiceId?: string
  privateVoiceKind?: PrivateVoiceKind
  privateVoiceConfig?: PrivateVoiceConfig
}

export const AUDIO_PROVIDER_OPTIONS = [
  { id: "inworld", label: "Inworld" },
  { id: "google", label: "Gemini" },
  { id: "qwen", label: "Qwen" },
  { id: "fal", label: "Seed Audio" },
  { id: "fish", label: "Fish Audio" },
] as const

export const DEFAULT_AUDIO_PROVIDER: AudioProvider = "inworld"

export const GOOGLE_GEMINI_TTS_MODEL = "google/gemini-3.1-flash-tts" as const
export const GOOGLE_GEMINI_TTS_MODEL_LABEL = "Gemini 3.1" as const
export const DEFAULT_GOOGLE_GEMINI_VOICE_ID = "Kore" as const
export const DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE = "en-US" as const
export const DEFAULT_GOOGLE_GEMINI_STYLE_PROMPT =
  "Say the following." as const
export const QWEN3_TTS_MODEL = "qwen/qwen3-tts" as const
export const QWEN3_TTS_MODEL_LABEL = "Qwen3 TTS" as const
export const DEFAULT_QWEN3_SPEAKER = "Serena" as const
export const DEFAULT_QWEN3_LANGUAGE = "auto" as const
export const SEED_AUDIO_MODEL = "bytedance/seed-audio-1.0" as const
export const SEED_AUDIO_MODEL_LABEL = "Seed Audio 1.0" as const
export const DEFAULT_SEED_AUDIO_VOICE = "auto" as const
export const FISH_AUDIO_TTS_MODEL = "s2.1-pro-free" as const
export const FISH_AUDIO_TTS_MODEL_LABEL = "Fish S2.1 Pro Free" as const
export const DEFAULT_FISH_AUDIO_VOICE = "default" as const

export type AudioModelGroup = "Current" | "Legacy"

export const AUDIO_MODEL_OPTIONS: readonly {
  id: string
  label: string
  description: string
  group: AudioModelGroup
  provider: AudioProvider
  deprecated: boolean
}[] = [
  {
    id: FISH_AUDIO_TTS_MODEL,
    label: FISH_AUDIO_TTS_MODEL_LABEL,
    description: "Fish Audio S2.1 Pro Free with its searchable voice library and saved private clones.",
    group: "Current",
    provider: "fish",
    deprecated: false,
  },
  {
    id: GOOGLE_GEMINI_TTS_MODEL,
    label: GOOGLE_GEMINI_TTS_MODEL_LABEL,
    description: "Google Gemini speech generation with style prompts and inline delivery tags.",
    group: "Current",
    provider: "google",
    deprecated: false,
  },
  {
    id: QWEN3_TTS_MODEL,
    label: QWEN3_TTS_MODEL_LABEL,
    description: "Natural multilingual speech with instant voice cloning and voice design.",
    group: "Current",
    provider: "qwen",
    deprecated: false,
  },
  {
    id: SEED_AUDIO_MODEL,
    label: SEED_AUDIO_MODEL_LABEL,
    description: "Generate speech and complete audio scenes from text, audio, or an image.",
    group: "Current",
    provider: "fal",
    deprecated: false,
  },
  ...INWORLD_TTS_MODEL_OPTIONS.map((option) => ({
    ...option,
    provider: "inworld" as const,
  })),
]

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

export const QWEN3_TTS_SPEAKERS = [
  "Aiden",
  "Dylan",
  "Eric",
  "Ono_anna",
  "Ryan",
  "Serena",
  "Sohee",
  "Uncle_fu",
  "Vivian",
] as const

export const QWEN3_TTS_LANGUAGES = [
  "auto",
  "Chinese",
  "English",
  "Japanese",
  "Korean",
  "French",
  "German",
  "Italian",
  "Spanish",
  "Portuguese",
  "Russian",
] as const

export const SEED_AUDIO_SAMPLE_RATES = [
  8000,
  16000,
  24000,
  32000,
  44100,
  48000,
] as const

export const SEED_AUDIO_OUTPUT_FORMATS = [
  "wav",
  "mp3",
  "pcm",
  "ogg_opus",
] as const

export function getAudioProviderLabel(provider: AudioProvider | string) {
  return (
    AUDIO_PROVIDER_OPTIONS.find((option) => option.id === provider)?.label ??
    provider
  )
}

export function getDefaultAudioVoiceId(provider: AudioProvider) {
  if (provider === "google") return DEFAULT_GOOGLE_GEMINI_VOICE_ID
  if (provider === "qwen") return DEFAULT_QWEN3_SPEAKER
  if (provider === "fal") return DEFAULT_SEED_AUDIO_VOICE
  if (provider === "fish") return DEFAULT_FISH_AUDIO_VOICE
  return DEFAULT_INWORLD_VOICE_ID
}

export function getDefaultAudioVoiceName(provider: AudioProvider) {
  if (provider === "google") return DEFAULT_GOOGLE_GEMINI_VOICE_ID
  if (provider === "qwen") return DEFAULT_QWEN3_SPEAKER
  if (provider === "fal") return "Automatic"
  if (provider === "fish") return "Choose a Fish voice"
  return DEFAULT_INWORLD_VOICE_NAME
}

export function getDefaultAudioModel(provider: AudioProvider) {
  if (provider === "google") return GOOGLE_GEMINI_TTS_MODEL
  if (provider === "qwen") return QWEN3_TTS_MODEL
  if (provider === "fal") return SEED_AUDIO_MODEL
  if (provider === "fish") return FISH_AUDIO_TTS_MODEL
  return DEFAULT_INWORLD_TTS_MODEL
}

export function getAudioModelOption(modelId?: string | null) {
  return AUDIO_MODEL_OPTIONS.find((model) => model.id === modelId)
}

export function getAudioProviderForModel(modelId?: string | null): AudioProvider {
  return getAudioModelOption(modelId)?.provider ?? DEFAULT_AUDIO_PROVIDER
}

import { productLogo } from "@/lib/product/branding"

/** Icon shown next to TTS model options (brand logo for Inworld, Gemini mark for Google). */
export function getAudioModelIconSrc(modelId?: string | null) {
  const provider = getAudioProviderForModel(modelId)
  if (provider === "google") return "/ai_icons/gemini-color.svg"
  if (provider === "qwen") return "/ai_icons/qwen.svg"
  if (provider === "fal") return "/ai_icons/bytedance-color.svg"
  if (provider === "fish") return productLogo
  return productLogo
}

export function getAudioModelLabel(modelId?: string | null) {
  return getAudioModelOption(modelId)?.label ?? modelId ?? null
}

export const AUDIO_MODEL_ADVICE: Record<AudioProvider, string> = {
  inworld:
    "Inworld 1.5 Max: start with a preset whose age, timbre, accent, and energy already fit. Use natural punctuation and coherent wording to guide expression.",
  google:
    "Gemini 3.1: write an audio profile, a short scene, then director notes for tone, accent, pace, breathing, and articulation. Keep the script consistent with that direction.",
  qwen:
    "Qwen3 TTS: cloning works best from 5–15 seconds of clean single-speaker speech. For Voice Design, describe age, pitch, timbre, accent, vocal texture, and persona.",
  fal:
    "Seed Audio 1.0: reference up to three clips in the script as @Audio1, @Audio2, and @Audio3. Explain what to borrow from each; use an image instead when the sound should follow a visual scene.",
  fish:
    "Fish S2.1 Pro Free: choose a voice from the Fish library or create a saved private clone from clear, single-speaker audio you own or have permission to use.",
}

export function getAudioVoiceSourceLabel(source: string) {
  switch (source) {
    case "SYSTEM":
      return "Built-in"
    case "IVC":
      return "Cloned"
    case "PVC":
      return "Pro Clone"
    case "CLONE":
      return "My Clones"
    case "DESIGN":
      return "My Designs"
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

export function buildFallbackQwenVoices(): AudioVoice[] {
  return QWEN3_TTS_SPEAKERS.map((speaker) => ({
    voiceId: speaker,
    displayName: speaker.replace(/_/g, " "),
    description: "Built-in Qwen3 voice.",
    langCode: DEFAULT_QWEN3_LANGUAGE,
    tags: ["qwen3-tts", "preset"],
    source: "SYSTEM",
    provider: "qwen",
    providerVoiceId: speaker,
    model: QWEN3_TTS_MODEL,
  }))
}

export function buildFallbackSeedAudioVoices(): AudioVoice[] {
  return [
    {
      voiceId: DEFAULT_SEED_AUDIO_VOICE,
      displayName: "Automatic",
      description: "Let Seed Audio choose a voice from your prompt.",
      langCode: "",
      tags: ["seed-audio", "automatic"],
      source: "SYSTEM",
      provider: "fal",
      providerVoiceId: DEFAULT_SEED_AUDIO_VOICE,
      model: SEED_AUDIO_MODEL,
    },
  ]
}

export function buildFallbackFishAudioVoices(): AudioVoice[] {
  return []
}
