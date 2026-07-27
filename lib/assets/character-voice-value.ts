import type { AudioProvider, AudioVoice } from "@/lib/constants/audio"
import {
  buildFallbackGoogleGeminiVoices,
  buildFallbackQwenVoices,
  getAudioProviderLabel,
} from "@/lib/constants/audio"

export type CharacterVoiceValue = {
  /** Runtime voice id used by Audio Studio (`private:{uuid}` or catalog id). */
  voiceId: string | null
  voiceProvider: string | null
  /** Set only when the attached voice is a private profile. */
  privateVoiceId: string | null
  displayName?: string | null
  previewUrl?: string | null
}

export function emptyCharacterVoice(): CharacterVoiceValue {
  return {
    voiceId: null,
    voiceProvider: null,
    privateVoiceId: null,
    displayName: null,
    previewUrl: null,
  }
}

export function hasCharacterVoice(value: CharacterVoiceValue) {
  return Boolean(value.voiceId?.trim())
}

export function characterVoiceFromAudioVoice(voice: AudioVoice): CharacterVoiceValue {
  return {
    voiceId: voice.voiceId,
    voiceProvider: typeof voice.provider === "string" ? voice.provider : null,
    privateVoiceId: voice.privateVoiceId ?? null,
    displayName: voice.displayName,
    previewUrl: voice.previewAudioUrl ?? null,
  }
}

export function characterVoiceDisplayName(value: CharacterVoiceValue) {
  const explicit = value.displayName?.trim()
  if (explicit) return explicit
  const voiceId = value.voiceId?.trim()
  if (!voiceId) return "Voice"
  if (voiceId.startsWith("private:")) return "Private voice"
  return voiceId.replace(/_/g, " ")
}

export function isCharacterVoiceProvider(
  value: string | null | undefined,
): value is "qwen" | "google" {
  return value === "qwen" || value === "google"
}

export async function fetchAttachableCharacterVoices(): Promise<AudioVoice[]> {
  const providers: AudioProvider[] = ["qwen", "google"]
  const results = await Promise.all(
    providers.map(async (provider) => {
      try {
        const response = await fetch(`/api/voices?provider=${provider}`)
        if (!response.ok) {
          return provider === "google"
            ? buildFallbackGoogleGeminiVoices()
            : buildFallbackQwenVoices()
        }
        const payload = (await response.json().catch(() => ({}))) as {
          voices?: AudioVoice[]
        }
        const voices = Array.isArray(payload.voices) ? payload.voices : []
        if (voices.length > 0) return voices
        return provider === "google"
          ? buildFallbackGoogleGeminiVoices()
          : buildFallbackQwenVoices()
      } catch {
        return provider === "google"
          ? buildFallbackGoogleGeminiVoices()
          : buildFallbackQwenVoices()
      }
    }),
  )

  const byKey = new Map<string, AudioVoice>()
  for (const voice of results.flat()) {
    const provider = typeof voice.provider === "string" ? voice.provider : ""
    const key = `${provider}:${voice.voiceId}`
    if (!byKey.has(key)) byKey.set(key, voice)
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const aPrivate = Boolean(a.privateVoiceId)
    const bPrivate = Boolean(b.privateVoiceId)
    if (aPrivate !== bPrivate) return aPrivate ? -1 : 1
    const providerA = a.provider ?? ""
    const providerB = b.provider ?? ""
    if (providerA !== providerB) return providerA.localeCompare(providerB)
    return a.displayName.localeCompare(b.displayName)
  })
}

export function groupAttachableCharacterVoices(voices: AudioVoice[]) {
  const privateVoices = voices.filter((voice) => Boolean(voice.privateVoiceId))
  const catalogByProvider = new Map<string, AudioVoice[]>()

  for (const voice of voices) {
    if (voice.privateVoiceId) continue
    const provider = typeof voice.provider === "string" ? voice.provider : "other"
    const bucket = catalogByProvider.get(provider) ?? []
    bucket.push(voice)
    catalogByProvider.set(provider, bucket)
  }

  return {
    privateVoices,
    catalogGroups: Array.from(catalogByProvider.entries()).map(([provider, items]) => ({
      provider,
      label: getAudioProviderLabel(provider),
      voices: items,
    })),
  }
}

export function voiceSelectValue(voice: AudioVoice) {
  const provider = typeof voice.provider === "string" ? voice.provider : "unknown"
  return `${provider}::${voice.voiceId}`
}

export function findVoiceBySelectValue(voices: AudioVoice[], value: string) {
  const separator = value.indexOf("::")
  if (separator <= 0) return null
  const provider = value.slice(0, separator)
  const voiceId = value.slice(separator + 2)
  return (
    voices.find(
      (voice) => voice.voiceId === voiceId && (voice.provider ?? "") === provider,
    ) ?? null
  )
}
