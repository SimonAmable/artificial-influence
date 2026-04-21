import "server-only"

import Replicate from "replicate"

import {
  DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE,
  DEFAULT_GOOGLE_GEMINI_STYLE_PROMPT,
  DEFAULT_GOOGLE_GEMINI_VOICE_ID,
  GOOGLE_GEMINI_TTS_MODEL,
} from "@/lib/constants/audio"

interface GoogleGeminiTtsInput {
  text: string
  voiceId?: string
  stylePrompt?: string
  languageCode?: string
  modelId?: string
}

type ResponseLike = {
  arrayBuffer?: () => Promise<ArrayBuffer>
  blob?: () => Promise<Blob>
  headers?: {
    get?: (name: string) => string | null
  }
  url?: string | (() => string)
  toString?: () => string
}

function getReplicateClient() {
  const auth = process.env.REPLICATE_API_TOKEN?.trim()
  if (!auth) {
    throw new Error("REPLICATE_API_TOKEN environment variable is not set")
  }
  return new Replicate({ auth })
}

function extractOutputUrl(output: unknown): string | null {
  if (typeof output === "string" && output.length > 0) return output

  if (Array.isArray(output) && output.length > 0) {
    const first = output[0]
    return typeof first === "string" ? first : extractOutputUrl(first)
  }

  if (!output || typeof output !== "object") return null

  const candidate = output as {
    url?: string | (() => string)
    toString?: () => string
  }

  if (typeof candidate.url === "function") {
    const nextUrl = candidate.url()
    return typeof nextUrl === "string" && nextUrl.length > 0 ? nextUrl : null
  }

  if (typeof candidate.url === "string" && candidate.url.length > 0) {
    return candidate.url
  }

  const text = candidate.toString?.()
  if (typeof text === "string" && /^https?:\/\//.test(text)) {
    return text
  }

  return null
}

function unwrapOutput(output: unknown): unknown {
  if (Array.isArray(output) && output.length > 0) {
    return output[0]
  }

  return output
}

function isResponseLike(output: unknown): output is ResponseLike {
  return (
    !!output &&
    typeof output === "object" &&
    (typeof (output as ResponseLike).arrayBuffer === "function" ||
      typeof (output as ResponseLike).blob === "function")
  )
}

function describeOutputShape(output: unknown): string {
  if (output === null) return "null"
  if (output === undefined) return "undefined"
  if (typeof output === "string") return "string"
  if (Array.isArray(output)) {
    const first: string = output.length > 0 ? describeOutputShape(output[0]) : "empty"
    return `array(${first})`
  }
  if (typeof output === "object") {
    return `object(${Object.keys(output as Record<string, unknown>).join(",")})`
  }
  return typeof output
}

async function readOutputAudio(
  output: unknown
): Promise<{ audioBuffer: Buffer; mimeType: "audio/mpeg" | "audio/wav" }> {
  const resolvedOutput = unwrapOutput(output)

  if (isResponseLike(resolvedOutput)) {
    if (typeof resolvedOutput.arrayBuffer === "function") {
      const mimeType = normalizeAudioMimeType(
        resolvedOutput.headers?.get?.("content-type") ?? null
      )
      const audioBuffer = Buffer.from(await resolvedOutput.arrayBuffer())
      return { audioBuffer, mimeType }
    }

    if (typeof resolvedOutput.blob === "function") {
      const blob = await resolvedOutput.blob()
      const mimeType = normalizeAudioMimeType(blob.type || null)
      const audioBuffer = Buffer.from(await blob.arrayBuffer())
      return { audioBuffer, mimeType }
    }
  }

  const outputUrl = extractOutputUrl(resolvedOutput)
  if (!outputUrl) {
    throw new Error(
      `Gemini TTS returned an unsupported output shape: ${describeOutputShape(output)}`
    )
  }

  const response = await fetch(outputUrl)
  if (!response.ok) {
    throw new Error(
      `Failed to download Gemini TTS audio (${response.status} ${response.statusText})`
    )
  }

  const mimeType = normalizeAudioMimeType(response.headers.get("content-type"))
  const audioBuffer = Buffer.from(await response.arrayBuffer())
  return { audioBuffer, mimeType }
}

function normalizeAudioMimeType(contentType: string | null) {
  const normalized = (contentType ?? "").toLowerCase()
  if (normalized.includes("wav")) {
    return "audio/wav" as const
  }
  return "audio/mpeg" as const
}

function getFileExtension(mimeType: string) {
  return mimeType === "audio/wav" ? "wav" : "mp3"
}

export async function synthesizeGoogleGeminiSpeech({
  text,
  voiceId,
  stylePrompt,
  languageCode,
  modelId,
}: GoogleGeminiTtsInput) {
  const replicate = getReplicateClient()
  const resolvedModelId = modelId?.trim() || GOOGLE_GEMINI_TTS_MODEL
  const resolvedVoiceId = voiceId?.trim() || DEFAULT_GOOGLE_GEMINI_VOICE_ID
  const resolvedStylePrompt =
    stylePrompt?.trim() || DEFAULT_GOOGLE_GEMINI_STYLE_PROMPT
  const resolvedLanguageCode =
    languageCode?.trim() || DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE

  const output = await replicate.run(resolvedModelId as `${string}/${string}`, {
    input: {
      text,
      voice: resolvedVoiceId,
      prompt: resolvedStylePrompt,
      language_code: resolvedLanguageCode,
    },
  })
  const { audioBuffer, mimeType } = await readOutputAudio(output)

  return {
    audioBuffer,
    mimeType,
    fileExtension: getFileExtension(mimeType),
    modelId: resolvedModelId,
    usage: {
      provider: "google",
      voiceId: resolvedVoiceId,
      languageCode: resolvedLanguageCode,
    },
  }
}
