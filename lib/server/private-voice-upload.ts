import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { MAX_PRIVATE_VOICE_REFERENCE_SECONDS } from "@/lib/constants/audio"
import { getAudioDurationSeconds } from "@/lib/video-editor/media-parser"

export function readFormString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export function safeAudioExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase()
  if (fromName && /^(wav|mp3|mpeg|m4a|ogg|opus|flac|webm)$/.test(fromName)) {
    return fromName === "mpeg" ? "mp3" : fromName
  }
  if (file.type.includes("wav")) return "wav"
  if (file.type.includes("ogg") || file.type.includes("opus")) return "ogg"
  if (file.type.includes("webm")) return "webm"
  if (file.type.includes("mp4")) return "m4a"
  return "mp3"
}

export function readPrivateVoiceConfigFromForm(formData: FormData) {
  const config: Record<string, string> = {}

  for (const key of [
    "baseVoice",
    "language",
    "languageCode",
    "referenceText",
    "styleInstruction",
    "stylePrompt",
    "voiceDescription",
  ]) {
    const value = readFormString(formData, key)
    if (value) config[key] = value
  }

  return config
}

type ReferenceUploadResult =
  | { ok: true; path: string }
  | { ok: false; status: number; error: string }

export async function validateAndUploadPrivateVoiceReference({
  supabase,
  userId,
  voiceId,
  file,
  previousPath,
}: {
  supabase: SupabaseClient
  userId: string
  voiceId: string
  file: File
  previousPath?: string | null
}): Promise<ReferenceUploadResult> {
  if (!file.type.startsWith("audio/")) {
    return {
      ok: false,
      status: 400,
      error: "Upload an audio recording to clone this voice.",
    }
  }
  if (file.size > 20 * 1024 * 1024) {
    return {
      ok: false,
      status: 400,
      error: "Voice recordings must be under 20 MB.",
    }
  }

  let durationSeconds: number
  try {
    durationSeconds = await getAudioDurationSeconds(file)
  } catch {
    return {
      ok: false,
      status: 400,
      error: "Could not read the reference recording duration.",
    }
  }

  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds > MAX_PRIVATE_VOICE_REFERENCE_SECONDS
  ) {
    return {
      ok: false,
      status: 400,
      error: "Reference recordings must be 15 seconds or shorter.",
    }
  }

  const referenceStoragePath = `${userId}/${voiceId}/reference.${safeAudioExtension(file)}`
  const { error: uploadError } = await supabase.storage
    .from("private-voices")
    .upload(referenceStoragePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type || "audio/mpeg",
      upsert: true,
    })

  if (uploadError) {
    return { ok: false, status: 500, error: uploadError.message }
  }

  if (previousPath && previousPath !== referenceStoragePath) {
    await supabase.storage.from("private-voices").remove([previousPath])
  }

  return { ok: true, path: referenceStoragePath }
}
