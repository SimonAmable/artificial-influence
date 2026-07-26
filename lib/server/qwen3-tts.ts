import "server-only"

import Replicate from "replicate"

import {
  DEFAULT_QWEN3_LANGUAGE,
  DEFAULT_QWEN3_SPEAKER,
  QWEN3_TTS_LANGUAGES,
  QWEN3_TTS_MODEL,
  QWEN3_TTS_SPEAKERS,
} from "@/lib/constants/audio"
import { readGeneratedAudio } from "@/lib/server/generated-audio-output"

export type Qwen3TtsMode = "custom_voice" | "voice_clone" | "voice_design"

interface Qwen3TtsInput {
  text: string
  mode?: Qwen3TtsMode
  speaker?: string
  language?: string
  referenceAudioUrl?: string | null
  referenceText?: string | null
  styleInstruction?: string | null
  voiceDescription?: string | null
}

function getReplicateClient() {
  const auth = process.env.REPLICATE_API_TOKEN?.trim()
  if (!auth) throw new Error("REPLICATE_API_TOKEN environment variable is not set")
  return new Replicate({ auth })
}

function normalizeLanguage(value?: string | null) {
  return QWEN3_TTS_LANGUAGES.includes(
    value as (typeof QWEN3_TTS_LANGUAGES)[number]
  )
    ? value
    : DEFAULT_QWEN3_LANGUAGE
}

function normalizeSpeaker(value?: string | null) {
  return QWEN3_TTS_SPEAKERS.includes(
    value as (typeof QWEN3_TTS_SPEAKERS)[number]
  )
    ? value
    : DEFAULT_QWEN3_SPEAKER
}

export async function synthesizeQwen3Speech(input: Qwen3TtsInput) {
  const mode = input.mode ?? "custom_voice"
  const replicateInput: Record<string, unknown> = {
    text: input.text,
    mode,
    language: normalizeLanguage(input.language),
  }

  if (mode === "custom_voice") {
    replicateInput.speaker = normalizeSpeaker(input.speaker)
  }
  if (mode === "voice_clone") {
    if (!input.referenceAudioUrl) {
      throw new Error("This cloned voice is missing its private reference audio.")
    }
    replicateInput.reference_audio = input.referenceAudioUrl
    if (input.referenceText?.trim()) {
      replicateInput.reference_text = input.referenceText.trim()
    }
  }
  if (mode === "voice_design") {
    if (!input.voiceDescription?.trim()) {
      throw new Error("A voice description is required for Qwen voice design.")
    }
    replicateInput.voice_description = input.voiceDescription.trim()
  }
  if (input.styleInstruction?.trim()) {
    replicateInput.style_instruction = input.styleInstruction.trim()
  }

  const output = await getReplicateClient().run(QWEN3_TTS_MODEL, {
    input: replicateInput,
  })
  const audio = await readGeneratedAudio(output)

  return {
    ...audio,
    modelId: QWEN3_TTS_MODEL,
    usage: {
      provider: "qwen",
      mode,
      language: replicateInput.language,
      speaker: replicateInput.speaker,
    },
  }
}
