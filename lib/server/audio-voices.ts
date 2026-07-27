import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  type AudioProvider,
  type AudioVoice,
  type PrivateVoiceConfig,
  buildFallbackGoogleGeminiVoices,
  buildFallbackQwenVoices,
  buildFallbackSeedAudioVoices,
  getAudioVoiceSearchText,
} from "@/lib/constants/audio"

const PRIVATE_VOICE_PREVIEW_TTL_SECONDS = 60 * 60

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

export interface PrivateVoiceRow {
  id: string
  name: string
  provider: string
  model_id: string
  kind: "clone" | "design"
  config: Record<string, unknown> | null
  reference_storage_path?: string | null
  preview_storage_path?: string | null
}

function readPrivateVoiceConfig(
  config: Record<string, unknown> | null
): PrivateVoiceConfig {
  const source = config ?? {}
  const next: PrivateVoiceConfig = {}

  for (const key of [
    "baseVoice",
    "language",
    "languageCode",
    "referenceText",
    "styleInstruction",
    "stylePrompt",
    "voiceDescription",
  ] as const) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) {
      next[key] = value
    }
  }

  return next
}

export function mapPrivateVoiceRow(
  row: PrivateVoiceRow,
  {
    previewAudioUrl,
    referenceAudioUrl,
  }: {
    previewAudioUrl?: string | null
    referenceAudioUrl?: string | null
  } = {}
): AudioVoice {
  const config = readPrivateVoiceConfig(row.config)
  return {
    voiceId: `private:${row.id}`,
    displayName: row.name,
    description:
      row.kind === "clone"
        ? "Your private cloned voice."
        : "Your reusable designed voice.",
    langCode: config.languageCode ?? config.language ?? "",
    tags: ["private", row.kind, row.provider],
    source: row.kind === "clone" ? "CLONE" : "DESIGN",
    provider: row.provider,
    providerVoiceId: `private:${row.id}`,
    model: row.model_id,
    previewAudioUrl: previewAudioUrl || undefined,
    referenceAudioUrl: referenceAudioUrl || undefined,
    privateVoiceId: row.id,
    privateVoiceKind: row.kind,
    privateVoiceConfig: config,
  }
}

async function signPrivateVoicePreviewUrls(
  supabase: SupabaseClient,
  rows: PrivateVoiceRow[]
) {
  const paths = [
    ...new Set(
      rows.flatMap((row) => {
        const next: string[] = []
        if (row.preview_storage_path) next.push(row.preview_storage_path)
        if (row.reference_storage_path) next.push(row.reference_storage_path)
        return next
      })
    ),
  ]

  if (paths.length === 0) {
    return new Map<string, string>()
  }

  const { data, error } = await supabase.storage
    .from("private-voices")
    .createSignedUrls(paths, PRIVATE_VOICE_PREVIEW_TTL_SECONDS)

  if (error) {
    console.warn("Failed to sign private voice preview URLs:", error.message)
    return new Map<string, string>()
  }

  const signedByPath = new Map<string, string>()
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl && !entry.error) {
      signedByPath.set(entry.path, entry.signedUrl)
    }
  }
  return signedByPath
}

export async function mapPrivateVoiceRows(
  supabase: SupabaseClient,
  rows: PrivateVoiceRow[]
): Promise<AudioVoice[]> {
  const signedByPath = await signPrivateVoicePreviewUrls(supabase, rows)
  return rows.map((row) => {
    const generatedPreviewUrl = row.preview_storage_path
      ? signedByPath.get(row.preview_storage_path)
      : undefined
    const referenceAudioUrl = row.reference_storage_path
      ? signedByPath.get(row.reference_storage_path)
      : undefined
    return mapPrivateVoiceRow(row, {
      previewAudioUrl: generatedPreviewUrl || referenceAudioUrl,
      referenceAudioUrl,
    })
  })
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

  const [{ data, error }, { data: privateData, error: privateError }] =
    await Promise.all([
      query,
      supabase
        .from("private_audio_voices")
        .select("id, name, provider, model_id, kind, config, reference_storage_path, preview_storage_path")
        .eq("provider", provider)
        .order("created_at", { ascending: false }),
    ])

  const missingPrivateTable =
    privateError?.code === "42P01" || privateError?.code === "PGRST205"
  if (error && error.code !== "42P01" && error.code !== "PGRST205") {
    throw new Error(error.message)
  }
  if (privateError && !missingPrivateTable) {
    throw new Error(privateError.message)
  }

  const privateVoices = Array.isArray(privateData)
    ? await mapPrivateVoiceRows(supabase, privateData as PrivateVoiceRow[])
    : []
  const catalogVoices = Array.isArray(data)
    ? (data as VoiceRow[]).map(mapVoiceRow)
    : []

  let fallbackVoices: AudioVoice[] = []
  if (provider === "google" && catalogVoices.length === 0) {
    fallbackVoices = buildFallbackGoogleGeminiVoices()
  } else if (provider === "qwen") {
    fallbackVoices = buildFallbackQwenVoices()
  } else if (provider === "fal") {
    fallbackVoices = buildFallbackSeedAudioVoices()
  }

  return [...privateVoices, ...catalogVoices, ...fallbackVoices]
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
  const providers: AudioProvider[] = provider
    ? [provider]
    : ["inworld", "google", "qwen", "fal"]
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
