import "server-only"

import { createClient } from "@/lib/supabase/server"
import {
  type AudioProvider,
  type AudioVoice,
  buildFallbackGoogleGeminiVoices,
} from "@/lib/constants/audio"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

interface VoiceRow {
  provider: string
  provider_voice_id: string
  display_name: string
  description: string | null
  lang_code: string | null
  tags: unknown
  source: string | null
  name: string | null
  model: string | null
  preview_text: string | null
  preview_audio_url: string | null
}

function mapVoiceRow(row: VoiceRow): AudioVoice {
  return {
    voiceId: row.provider_voice_id,
    displayName: row.display_name,
    description: row.description ?? "",
    langCode: row.lang_code ?? "",
    tags: Array.isArray(row.tags)
      ? row.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    source: row.source ?? "SYSTEM",
    name: row.name ?? undefined,
    provider: row.provider,
    providerVoiceId: row.provider_voice_id,
    model: row.model,
    previewText: row.preview_text ?? undefined,
    previewAudioUrl: row.preview_audio_url ?? undefined,
  }
}

export async function listCatalogVoices(
  supabase: SupabaseServerClient,
  {
    provider,
    languages = [],
  }: {
    provider: AudioProvider
    languages?: string[]
  }
) {
  let query = supabase
    .from("voices")
    .select(
      "provider, provider_voice_id, display_name, description, lang_code, tags, source, name, model, preview_text, preview_audio_url"
    )
    .eq("provider", provider)
    .eq("is_active", true)
    .order("source", { ascending: true, nullsFirst: false })
    .order("display_name", { ascending: true })

  if (languages.length > 0) {
    query = query.in("lang_code", languages)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  const voices = Array.isArray(data)
    ? (data as VoiceRow[]).map(mapVoiceRow)
    : []

  if (provider === "google" && voices.length === 0) {
    return buildFallbackGoogleGeminiVoices()
  }

  return voices
}
