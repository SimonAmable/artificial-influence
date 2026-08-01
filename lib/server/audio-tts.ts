import "server-only"

import {
  DEFAULT_AUDIO_PROVIDER,
  GOOGLE_GEMINI_TTS_MODEL,
  QWEN3_TTS_MODEL,
  SEED_AUDIO_MODEL,
  FISH_AUDIO_TTS_MODEL,
  getDefaultAudioModel,
  getDefaultAudioVoiceId,
  type AudioProvider,
} from "@/lib/constants/audio"
import { synthesizeGoogleGeminiSpeech } from "@/lib/server/google-gemini-tts"
import { synthesizeInworldSpeech } from "@/lib/server/inworld-tts"
import {
  synthesizeQwen3Speech,
  type Qwen3TtsMode,
} from "@/lib/server/qwen3-tts"
import { synthesizeSeedAudio } from "@/lib/server/seed-audio"
import { synthesizeFishAudio } from "@/lib/server/fish-audio"

export interface AudioSynthesisInput {
  provider?: string | null
  text: string
  voiceId?: string | null
  modelId?: string | null
  stylePrompt?: string | null
  languageCode?: string | null
  qwenMode?: Qwen3TtsMode | null
  qwenLanguage?: string | null
  referenceAudioUrl?: string | null
  referenceText?: string | null
  styleInstruction?: string | null
  voiceDescription?: string | null
  audioUrls?: string[]
  imageUrl?: string | null
  outputFormat?: string | null
  sampleRate?: number | null
  speed?: number | null
  volume?: number | null
  pitch?: number | null
  multilingual?: boolean | null
}

export function isAudioProvider(value: string): value is AudioProvider {
  return (
    value === "inworld" ||
    value === "google" ||
    value === "qwen" ||
    value === "fal"
    || value === "fish"
  )
}

export function resolveAudioProvider(
  provider?: string | null,
  modelId?: string | null
): AudioProvider {
  if (provider && isAudioProvider(provider)) {
    return provider
  }

  if (modelId === GOOGLE_GEMINI_TTS_MODEL) {
    return "google"
  }
  if (modelId === QWEN3_TTS_MODEL) return "qwen"
  if (modelId === SEED_AUDIO_MODEL) return "fal"
  if (modelId === FISH_AUDIO_TTS_MODEL) return "fish"

  return DEFAULT_AUDIO_PROVIDER
}

export async function synthesizeSpeech(input: AudioSynthesisInput) {
  const provider = resolveAudioProvider(input.provider, input.modelId)
  const modelId = input.modelId?.trim() || getDefaultAudioModel(provider)
  const voiceId = input.voiceId?.trim() || getDefaultAudioVoiceId(provider)

  if (provider === "google") {
    return synthesizeGoogleGeminiSpeech({
      text: input.text,
      voiceId,
      modelId,
      stylePrompt: input.stylePrompt ?? undefined,
      languageCode: input.languageCode ?? undefined,
    })
  }

  if (provider === "qwen") {
    return synthesizeQwen3Speech({
      text: input.text,
      mode: input.qwenMode ?? undefined,
      speaker: voiceId,
      language: input.qwenLanguage ?? undefined,
      referenceAudioUrl: input.referenceAudioUrl,
      referenceText: input.referenceText,
      styleInstruction: input.styleInstruction,
      voiceDescription: input.voiceDescription,
    })
  }

  if (provider === "fal") {
    return synthesizeSeedAudio({
      prompt: input.text,
      voice: voiceId,
      audioUrls: input.audioUrls,
      imageUrl: input.imageUrl,
      outputFormat: input.outputFormat,
      sampleRate: input.sampleRate,
      speed: input.speed,
      volume: input.volume,
      pitch: input.pitch,
      multilingual: input.multilingual,
    })
  }

  if (provider === "fish") {
    return synthesizeFishAudio({ text: input.text, voiceId })
  }

  return synthesizeInworldSpeech({
    text: input.text,
    voiceId,
    modelId,
  })
}
