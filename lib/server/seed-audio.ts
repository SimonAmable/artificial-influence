import "server-only"

import { fal } from "@fal-ai/client"

import {
  SEED_AUDIO_MODEL,
  SEED_AUDIO_OUTPUT_FORMATS,
  SEED_AUDIO_SAMPLE_RATES,
} from "@/lib/constants/audio"
import { readGeneratedAudio } from "@/lib/server/generated-audio-output"

export interface SeedAudioInput {
  prompt: string
  voice?: string | null
  audioUrls?: string[]
  imageUrl?: string | null
  outputFormat?: string | null
  sampleRate?: number | null
  speed?: number | null
  volume?: number | null
  pitch?: number | null
  multilingual?: boolean | null
}

function clamp(value: number | null | undefined, min: number, max: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Number(value))) : fallback
}

export async function synthesizeSeedAudio(input: SeedAudioInput) {
  const key = process.env.FAL_KEY?.trim()
  if (!key) throw new Error("FAL_KEY is not configured.")
  fal.config({ credentials: key })

  const audioUrls = (input.audioUrls ?? []).filter(Boolean).slice(0, 3)
  if (audioUrls.length > 0 && input.imageUrl) {
    throw new Error("Seed Audio accepts audio references or an image, not both.")
  }

  const outputFormat = SEED_AUDIO_OUTPUT_FORMATS.includes(
    input.outputFormat as (typeof SEED_AUDIO_OUTPUT_FORMATS)[number]
  )
    ? input.outputFormat
    : "mp3"
  const sampleRate = SEED_AUDIO_SAMPLE_RATES.includes(
    Number(input.sampleRate) as (typeof SEED_AUDIO_SAMPLE_RATES)[number]
  )
    ? Number(input.sampleRate)
    : 24000

  const providerInput: Record<string, unknown> = {
    prompt: input.prompt,
    output_format: outputFormat,
    sample_rate: sampleRate,
    speed: clamp(input.speed, 0.5, 2, 1),
    volume: clamp(input.volume, 0.5, 2, 1),
    pitch: Math.round(clamp(input.pitch, -12, 12, 0)),
    multilingual: input.multilingual ?? false,
  }
  if (input.voice && input.voice !== "auto") providerInput.voice = input.voice
  if (audioUrls.length > 0) providerInput.audio_urls = audioUrls
  if (input.imageUrl) providerInput.image_url = input.imageUrl

  const result = await fal.subscribe(SEED_AUDIO_MODEL, {
    input: providerInput as never,
    logs: false,
  })
  const audio = await readGeneratedAudio(result.data)

  return {
    ...audio,
    modelId: SEED_AUDIO_MODEL,
    usage: {
      provider: "fal",
      outputFormat,
      sampleRate,
      referenceAudioCount: audioUrls.length,
      hasReferenceImage: Boolean(input.imageUrl),
    },
  }
}
