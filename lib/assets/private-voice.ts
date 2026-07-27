import type { SupabaseClient } from "@supabase/supabase-js"
import type { AudioVoice } from "@/lib/constants/audio"
import type { AssetVoiceAttachmentInput } from "@/lib/assets/types"
import { mapPrivateVoiceRows, type PrivateVoiceRow } from "@/lib/server/audio-voices"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const VOICE_PROVIDERS = new Set(["qwen", "google", "inworld", "fal"])

export function parseOptionalPrivateVoiceId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!UUID_RE.test(trimmed)) return undefined
  return trimmed
}

export function parseOptionalVoiceId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > 120) return undefined
  return trimmed
}

export function parseOptionalVoiceProvider(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== "string") return undefined
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  if (!VOICE_PROVIDERS.has(trimmed)) return undefined
  return trimmed
}

export async function assertOwnedPrivateVoiceId(
  supabase: SupabaseClient,
  userId: string,
  privateVoiceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("private_audio_voices")
    .select("id, provider")
    .eq("id", privateVoiceId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: error.message }
  }
  if (!data) {
    return { ok: false, error: "Private voice not found" }
  }
  return { ok: true }
}

export async function resolveVoiceAttachmentUpdate(
  supabase: SupabaseClient,
  userId: string,
  input: AssetVoiceAttachmentInput,
): Promise<
  | {
      ok: true
      privateVoiceId: string | null
      voiceId: string | null
      voiceProvider: string | null
    }
  | { ok: false; error: string }
> {
  const voiceId = parseOptionalVoiceId(input.voiceId)
  const voiceProvider = parseOptionalVoiceProvider(input.voiceProvider)
  const explicitPrivateId =
    input.privateVoiceId === undefined
      ? null
      : parseOptionalPrivateVoiceId(input.privateVoiceId)

  if (voiceId === undefined || voiceProvider === undefined || explicitPrivateId === undefined) {
    return { ok: false, error: "Invalid voice attachment" }
  }

  if (!voiceId) {
    return {
      ok: true,
      privateVoiceId: null,
      voiceId: null,
      voiceProvider: null,
    }
  }

  if (!voiceProvider) {
    return { ok: false, error: "Voice provider is required" }
  }

  if (voiceId.startsWith("private:")) {
    const privateVoiceId = voiceId.slice("private:".length)
    if (!UUID_RE.test(privateVoiceId)) {
      return { ok: false, error: "Invalid private voice id" }
    }
    const ownership = await assertOwnedPrivateVoiceId(supabase, userId, privateVoiceId)
    if (!ownership.ok) return ownership
    if (voiceProvider !== "qwen" && voiceProvider !== "google") {
      return { ok: false, error: "Unsupported private voice provider" }
    }
    return {
      ok: true,
      privateVoiceId,
      voiceId,
      voiceProvider,
    }
  }

  if (explicitPrivateId) {
    const ownership = await assertOwnedPrivateVoiceId(supabase, userId, explicitPrivateId)
    if (!ownership.ok) return ownership
    return {
      ok: true,
      privateVoiceId: explicitPrivateId,
      voiceId: `private:${explicitPrivateId}`,
      voiceProvider,
    }
  }

  return {
    ok: true,
    privateVoiceId: null,
    voiceId,
    voiceProvider,
  }
}

export async function loadPrivateVoiceSummariesByIds(
  supabase: SupabaseClient,
  voiceIds: string[],
): Promise<
  Map<
    string,
    {
      id: string
      name: string
      provider: string
      previewUrl: string | null
    }
  >
> {
  const uniqueIds = [...new Set(voiceIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from("private_audio_voices")
    .select("id, name, provider, model_id, kind, config, reference_storage_path, preview_storage_path")
    .in("id", uniqueIds)

  if (error || !Array.isArray(data)) {
    if (error) {
      console.warn("[assets] Failed to load private voice summaries:", error.message)
    }
    return new Map()
  }

  const mapped = await mapPrivateVoiceRows(supabase, data as PrivateVoiceRow[])
  const byId = new Map<
    string,
    {
      id: string
      name: string
      provider: string
      previewUrl: string | null
    }
  >()

  for (const voice of mapped) {
    if (!voice.privateVoiceId) continue
    byId.set(voice.privateVoiceId, {
      id: voice.privateVoiceId,
      name: voice.displayName,
      provider: typeof voice.provider === "string" ? voice.provider : "",
      previewUrl: voice.previewAudioUrl ?? null,
    })
  }

  return byId
}

export function toPrivateVoiceRuntimeId(privateVoiceId: string) {
  return `private:${privateVoiceId}`
}

export function isPrivateAudioVoice(voice: AudioVoice) {
  return Boolean(voice.privateVoiceId)
}
