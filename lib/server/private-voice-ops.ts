import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  GOOGLE_GEMINI_TTS_MODEL,
  PRIVATE_VOICE_PREVIEW_TEXT,
  QWEN3_TTS_MODEL,
  getDefaultAudioVoiceId,
} from "@/lib/constants/audio"
import {
  mapPrivateVoiceRows,
  type PrivateVoiceRow,
} from "@/lib/server/audio-voices"
import { synthesizeSpeech } from "@/lib/server/audio-tts"
import {
  readFormString,
  readPrivateVoiceConfigFromForm,
  validateAndUploadPrivateVoiceReference,
} from "@/lib/server/private-voice-upload"

const PRIVATE_VOICE_SELECT =
  "id, name, provider, model_id, kind, config, reference_storage_path, preview_storage_path"

type UpsertResult =
  | { ok: true; row: PrivateVoiceRow; created: boolean }
  | { ok: false; status: number; error: string }

export async function upsertPrivateVoiceFromForm({
  supabase,
  userId,
  formData,
  voiceId,
}: {
  supabase: SupabaseClient
  userId: string
  formData: FormData
  voiceId?: string | null
}): Promise<UpsertResult> {
  const existingId = voiceId?.trim() || readFormString(formData, "voiceId") || null

  if (existingId) {
    const { data: existing, error: existingError } = await supabase
      .from("private_audio_voices")
      .select(PRIVATE_VOICE_SELECT)
      .eq("id", existingId)
      .eq("user_id", userId)
      .maybeSingle()

    if (existingError) {
      return { ok: false, status: 500, error: existingError.message }
    }
    if (!existing) {
      return { ok: false, status: 404, error: "Private voice not found." }
    }

    const current = existing as PrivateVoiceRow
    const name = readFormString(formData, "name") || current.name
    if (name.length < 2 || name.length > 80) {
      return { ok: false, status: 400, error: "Voice name must be 2–80 characters." }
    }

    const nextConfig: Record<string, unknown> = {
      ...(current.config ?? {}),
      ...readPrivateVoiceConfigFromForm(formData),
    }

    for (const key of ["styleInstruction", "stylePrompt"] as const) {
      if (formData.has(key) && !readFormString(formData, key)) {
        delete nextConfig[key]
      }
    }

    if (current.kind === "design" && current.provider === "qwen") {
      const voiceDescription =
        typeof nextConfig.voiceDescription === "string"
          ? nextConfig.voiceDescription.trim()
          : ""
      if (!voiceDescription) {
        return {
          ok: false,
          status: 400,
          error: "Designed voices need a voice description.",
        }
      }
    }

    if (current.kind === "design" && current.provider === "google") {
      const stylePrompt =
        typeof nextConfig.stylePrompt === "string"
          ? nextConfig.stylePrompt.trim()
          : ""
      if (!stylePrompt) {
        nextConfig.stylePrompt = "Say the following."
      }
    }

    let referenceStoragePath = current.reference_storage_path ?? null
    const file = formData.get("referenceAudio")
    if (file instanceof File && file.size > 0) {
      if (current.kind !== "clone") {
        return {
          ok: false,
          status: 400,
          error: "Only cloned voices can replace a reference recording.",
        }
      }

      const upload = await validateAndUploadPrivateVoiceReference({
        supabase,
        userId,
        voiceId: current.id,
        file,
        previousPath: current.reference_storage_path,
      })
      if (!upload.ok) {
        return { ok: false, status: upload.status, error: upload.error }
      }
      referenceStoragePath = upload.path

      const referenceText = readFormString(formData, "referenceText")
      if (referenceText) nextConfig.referenceText = referenceText
      else delete nextConfig.referenceText
    }

    const { data, error } = await supabase
      .from("private_audio_voices")
      .update({
        name,
        config: nextConfig,
        reference_storage_path: referenceStoragePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id)
      .eq("user_id", userId)
      .select(PRIVATE_VOICE_SELECT)
      .single()

    if (error) {
      return { ok: false, status: 500, error: error.message }
    }

    return { ok: true, row: data as PrivateVoiceRow, created: false }
  }

  const provider = readFormString(formData, "provider")
  const kind = readFormString(formData, "kind")
  const name = readFormString(formData, "name")

  if ((provider !== "qwen" && provider !== "google") || !["clone", "design"].includes(kind)) {
    return { ok: false, status: 400, error: "Unsupported private voice type." }
  }
  if (provider === "google" && kind !== "design") {
    return {
      ok: false,
      status: 400,
      error: "Gemini supports saved designed voice profiles, not voice cloning.",
    }
  }
  if (name.length < 2 || name.length > 80) {
    return { ok: false, status: 400, error: "Voice name must be 2–80 characters." }
  }

  if (provider === "qwen" && kind === "design") {
    const voiceDescription = readFormString(formData, "voiceDescription")
    if (!voiceDescription) {
      return {
        ok: false,
        status: 400,
        error: "Designed voices need a voice description.",
      }
    }
  }

  const id = crypto.randomUUID()
  let referenceStoragePath: string | null = null
  const config = readPrivateVoiceConfigFromForm(formData)

  if (kind === "clone") {
    const file = formData.get("referenceAudio")
    if (!(file instanceof File) || file.size <= 0) {
      return {
        ok: false,
        status: 400,
        error: "Upload an audio recording to clone this voice.",
      }
    }

    const upload = await validateAndUploadPrivateVoiceReference({
      supabase,
      userId,
      voiceId: id,
      file,
    })
    if (!upload.ok) {
      return { ok: false, status: upload.status, error: upload.error }
    }
    referenceStoragePath = upload.path
  }

  const modelId = provider === "qwen" ? QWEN3_TTS_MODEL : GOOGLE_GEMINI_TTS_MODEL
  const { data, error } = await supabase
    .from("private_audio_voices")
    .insert({
      id,
      user_id: userId,
      name,
      provider,
      model_id: modelId,
      kind,
      config,
      reference_storage_path: referenceStoragePath,
    })
    .select(PRIVATE_VOICE_SELECT)
    .single()

  if (error) {
    if (referenceStoragePath) {
      await supabase.storage.from("private-voices").remove([referenceStoragePath])
    }
    return { ok: false, status: 500, error: error.message }
  }

  return { ok: true, row: data as PrivateVoiceRow, created: true }
}

export async function generateAndStorePrivateVoicePreview({
  supabase,
  userId,
  row,
}: {
  supabase: SupabaseClient
  userId: string
  row: PrivateVoiceRow
}) {
  const config = row.config ?? {}
  const provider = row.provider === "google" ? "google" : "qwen"

  let voiceId = getDefaultAudioVoiceId(provider)
  const stylePrompt =
    typeof config.stylePrompt === "string" ? config.stylePrompt : ""
  const languageCode =
    typeof config.languageCode === "string" ? config.languageCode : ""
  let qwenMode: "voice_clone" | "voice_design" | "custom_voice" =
    row.kind === "clone" ? "voice_clone" : "voice_design"
  const qwenLanguage = typeof config.language === "string" ? config.language : ""
  let referenceAudioUrl = ""
  const referenceText =
    typeof config.referenceText === "string" ? config.referenceText : ""
  const styleInstruction =
    typeof config.styleInstruction === "string" ? config.styleInstruction : ""
  const voiceDescription =
    typeof config.voiceDescription === "string" ? config.voiceDescription : ""

  if (provider === "google") {
    voiceId =
      typeof config.baseVoice === "string" && config.baseVoice
        ? config.baseVoice
        : getDefaultAudioVoiceId("google")
    qwenMode = "custom_voice"
  } else if (row.kind === "clone") {
    if (!row.reference_storage_path) {
      return {
        ok: false as const,
        status: 409,
        error: "This cloned voice is missing its reference recording.",
      }
    }
    const { data: signedData, error: signedError } = await supabase.storage
      .from("private-voices")
      .createSignedUrl(row.reference_storage_path, 600)
    if (signedError || !signedData?.signedUrl) {
      return {
        ok: false as const,
        status: 500,
        error: signedError?.message || "Could not access private voice audio.",
      }
    }
    referenceAudioUrl = signedData.signedUrl
  } else if (!voiceDescription.trim()) {
    return {
      ok: false as const,
      status: 400,
      error: "Designed voices need a voice description before preview.",
    }
  }

  const result = await synthesizeSpeech({
    provider,
    text: PRIVATE_VOICE_PREVIEW_TEXT,
    voiceId,
    modelId: row.model_id,
    stylePrompt,
    languageCode,
    qwenMode,
    qwenLanguage,
    referenceAudioUrl,
    referenceText,
    styleInstruction,
    voiceDescription,
  })

  const previewStoragePath = `${userId}/${row.id}/preview.${result.fileExtension}`
  const { error: uploadError } = await supabase.storage
    .from("private-voices")
    .upload(previewStoragePath, result.audioBuffer, {
      contentType: result.mimeType,
      upsert: true,
    })

  if (uploadError) {
    return {
      ok: false as const,
      status: 500,
      error: uploadError.message || "Failed to store voice preview.",
    }
  }

  if (row.preview_storage_path && row.preview_storage_path !== previewStoragePath) {
    await supabase.storage.from("private-voices").remove([row.preview_storage_path])
  }

  const { data, error } = await supabase
    .from("private_audio_voices")
    .update({
      preview_storage_path: previewStoragePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("user_id", userId)
    .select(PRIVATE_VOICE_SELECT)
    .single()

  if (error) {
    return { ok: false as const, status: 500, error: error.message }
  }

  const [voice] = await mapPrivateVoiceRows(supabase, [data as PrivateVoiceRow])
  return {
    ok: true as const,
    voice,
    previewAudioUrl: voice.previewAudioUrl ?? null,
    mimeType: result.mimeType,
  }
}
