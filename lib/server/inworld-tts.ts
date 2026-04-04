import "server-only"

import {
  DEFAULT_INWORLD_TTS_MODEL,
  isInworldTtsModelId,
  type InworldTtsModelId,
  type InworldVoice,
} from "@/lib/constants/inworld-tts"

const INWORLD_API_BASE_URL = "https://api.inworld.ai"
const DEFAULT_SAMPLE_RATE_HERTZ = 22050

interface RawInworldVoice {
  voiceId?: string
  displayName?: string
  description?: string
  langCode?: string
  tags?: string[]
  source?: string
  name?: string
}

interface InworldVoicesResponse {
  voices?: RawInworldVoice[]
}

interface InworldSynthesizeResponse {
  audioContent?: string
  usage?: {
    processedCharactersCount?: number
    modelId?: string
  }
}

function getInworldAuthorizationHeader() {
  const apiKey = process.env.INWORLD_API_KEY_BASE64?.trim()

  if (!apiKey) {
    throw new Error(
      "INWORLD_API_KEY_BASE64 environment variable is not set"
    )
  }

  return `Basic ${apiKey}`
}

async function fetchInworldJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${INWORLD_API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: getInworldAuthorizationHeader(),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  })

  const text = await response.text()
  let payload: T | { message?: string; error?: string } | null = null

  if (text) {
    try {
      payload = JSON.parse(text) as T | { message?: string; error?: string }
    } catch {
      payload = { message: text }
    }
  }

  if (!response.ok) {
    const message =
      (payload &&
        typeof payload === "object" &&
        ("message" in payload || "error" in payload) &&
        ((payload as { message?: string }).message ||
          (payload as { error?: string }).error)) ||
      `Inworld request failed with status ${response.status}`

    throw new Error(message)
  }

  return payload as T
}

export async function listInworldVoices(languages: string[] = []) {
  const params = new URLSearchParams()

  for (const language of languages) {
    if (language.trim()) {
      params.append("languages", language.trim())
    }
  }

  const query = params.toString()
  const response = await fetchInworldJson<InworldVoicesResponse>(
    `/voices/v1/voices${query ? `?${query}` : ""}`,
    { method: "GET" }
  )

  const voices: InworldVoice[] = []

  for (const voice of response.voices ?? []) {
    if (!voice.voiceId || !voice.displayName || !voice.langCode) {
      continue
    }

    voices.push({
      voiceId: voice.voiceId,
      displayName: voice.displayName,
      description: voice.description ?? "",
      langCode: voice.langCode,
      tags: Array.isArray(voice.tags) ? voice.tags : [],
      source: voice.source ?? "SYSTEM",
      name: voice.name,
    })
  }

  return voices.sort((a, b) => {
    if (a.source !== b.source) {
      return a.source.localeCompare(b.source)
    }

    return a.displayName.localeCompare(b.displayName)
  })
}

export async function synthesizeInworldSpeech({
  text,
  voiceId,
  modelId,
}: {
  text: string
  voiceId: string
  modelId?: string
}) {
  const resolvedModelId: InworldTtsModelId = isInworldTtsModelId(modelId ?? "")
    ? (modelId as InworldTtsModelId)
    : DEFAULT_INWORLD_TTS_MODEL

  const response = await fetchInworldJson<InworldSynthesizeResponse>(
    "/tts/v1/voice",
    {
      method: "POST",
      body: JSON.stringify({
        text,
        voiceId,
        modelId: resolvedModelId,
        audioConfig: {
          audioEncoding: "LINEAR16",
          sampleRateHertz: DEFAULT_SAMPLE_RATE_HERTZ,
        },
        temperature: 1,
        applyTextNormalization: "ON",
      }),
    }
  )

  if (!response.audioContent) {
    throw new Error("Inworld did not return any audio content")
  }

  return {
    audioBuffer: Buffer.from(response.audioContent, "base64"),
    mimeType: "audio/wav",
    fileExtension: "wav" as const,
    modelId: resolvedModelId,
    usage: response.usage,
  }
}
