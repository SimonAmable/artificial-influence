import "server-only"

import { FISH_AUDIO_TTS_MODEL, type AudioVoice } from "@/lib/constants/audio"

const FISH_API_URL = "https://api.fish.audio"

function getApiKey() {
  const apiKey = process.env.FISH_AUDIO_API_KEY
  if (!apiKey) throw new Error("Fish Audio is not configured. Set FISH_AUDIO_API_KEY.")
  return apiKey
}

async function fishError(response: Response) {
  const detail = await response.text().catch(() => "")
  return new Error(`Fish Audio request failed (${response.status})${detail ? `: ${detail}` : ""}`)
}

export async function synthesizeFishAudio({ text, voiceId }: { text: string; voiceId: string }) {
  const response = await fetch(`${FISH_API_URL}/v1/tts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      model: FISH_AUDIO_TTS_MODEL,
    },
    body: JSON.stringify({ text, reference_id: voiceId, format: "mp3" }),
  })
  if (!response.ok) throw await fishError(response)
  return {
    audioBuffer: Buffer.from(await response.arrayBuffer()),
    mimeType: response.headers.get("content-type") || "audio/mpeg",
    fileExtension: "mp3",
    modelId: FISH_AUDIO_TTS_MODEL,
    usage: undefined,
  }
}

export async function createFishPrivateClone({ title, file, transcript }: { title: string; file: File; transcript?: string }): Promise<{ _id: string; state?: string }> {
  const form = new FormData()
  form.set("type", "tts")
  form.set("title", title)
  form.set("visibility", "private")
  form.set("train_mode", "fast")
  form.set("enhance_audio_quality", "true")
  form.append("voices", file)
  if (transcript) form.append("texts", transcript)
  const response = await fetch(`${FISH_API_URL}/model`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getApiKey()}` },
    body: form,
  })
  if (!response.ok) throw await fishError(response)
  const model = (await response.json()) as { _id?: string; state?: string }
  if (!model._id) throw new Error("Fish Audio did not return a voice ID.")
  return model
}

export async function listFishLibraryVoices(): Promise<AudioVoice[]> {
  const response = await fetch(`${FISH_API_URL}/model?page_size=100&sort_by=score`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
    next: { revalidate: 300 },
  })
  if (!response.ok) throw await fishError(response)
  const data = (await response.json()) as { items?: Array<Record<string, unknown>> }
  return (data.items ?? []).map((item) => ({
    voiceId: String(item._id ?? ""),
    displayName: String(item.title ?? "Fish voice"),
    description: typeof item.description === "string" ? item.description : "Fish Audio community voice.",
    langCode: Array.isArray(item.languages) ? item.languages.filter((value): value is string => typeof value === "string").join(", ") : "",
    tags: Array.isArray(item.tags) ? item.tags.filter((value): value is string => typeof value === "string") : [],
    source: "FISH_LIBRARY",
    provider: "fish" as const,
    providerVoiceId: String(item._id ?? ""),
    model: FISH_AUDIO_TTS_MODEL,
  })).filter((voice) => voice.voiceId)
}
