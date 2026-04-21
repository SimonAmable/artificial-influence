import "server-only"

import {
  DEFAULT_AUDIO_PROVIDER,
  GOOGLE_GEMINI_TTS_MODEL,
  getDefaultAudioModel,
  getDefaultAudioVoiceId,
  type AudioProvider,
} from "@/lib/constants/audio"
import { synthesizeGoogleGeminiSpeech } from "@/lib/server/google-gemini-tts"
import { synthesizeInworldSpeech } from "@/lib/server/inworld-tts"

export interface AudioSynthesisInput {
  provider?: string | null
  text: string
  voiceId?: string | null
  modelId?: string | null
  stylePrompt?: string | null
  languageCode?: string | null
}

export function isAudioProvider(value: string): value is AudioProvider {
  return value === "inworld" || value === "google"
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

  return synthesizeInworldSpeech({
    text: input.text,
    voiceId,
    modelId,
  })
}
