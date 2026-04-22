import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  type AudioProvider,
  type AudioVoice,
  buildFallbackGoogleGeminiVoices,
  getAudioVoiceSearchText,
} from "@/lib/constants/audio"

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
  supabase: SupabaseClient,
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

function normalizeSearchQuery(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function scoreVoiceMatch(voice: AudioVoice, query: string) {
  if (!query) return 1

  const haystack = getAudioVoiceSearchText(voice)
  const normalizedQuery = normalizeSearchQuery(query)

  if (haystack === normalizedQuery) return 100
  if (haystack.includes(normalizedQuery)) return 80

  const queryTokens = normalizedQuery.split(" ").filter(Boolean)
  const overlap = queryTokens.filter((token) => haystack.includes(token)).length

  return overlap > 0 ? 30 + overlap * 10 : 0
}

export async function searchCatalogVoices(
  supabase: SupabaseClient,
  {
    languages = [],
    limit = 8,
    provider,
    query,
    source,
  }: {
    languages?: string[]
    limit?: number
    provider?: AudioProvider
    query?: string
    source?: string
  },
) {
  const providers: AudioProvider[] = provider ? [provider] : ["inworld", "google"]
  const normalizedQuery = (query ?? "").trim()

  const allVoices = (
    await Promise.all(
      providers.map((currentProvider) =>
        listCatalogVoices(supabase, {
          provider: currentProvider,
          languages,
        }),
      ),
    )
  ).flat()

  const filtered = allVoices
    .filter((voice) => !source || voice.source === source)
    .map((voice) => ({
      score: scoreVoiceMatch(voice, normalizedQuery),
      voice,
    }))
    .filter((entry) => normalizedQuery.length === 0 || entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const providerA = a.voice.provider ?? ""
      const providerB = b.voice.provider ?? ""
      if (providerA !== providerB) return providerA.localeCompare(providerB)
      return a.voice.displayName.localeCompare(b.voice.displayName)
    })
    .slice(0, Math.min(Math.max(limit, 1), 20))
    .map((entry) => entry.voice)

  return filtered
}
