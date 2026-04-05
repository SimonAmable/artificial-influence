import { NextRequest, NextResponse } from "next/server"

import type { InworldVoice } from "@/lib/constants/inworld-tts"
import { createClient } from "@/lib/supabase/server"

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

function mapVoiceRow(row: VoiceRow): InworldVoice {
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
    previewText: row.preview_text ?? "",
    previewAudioUrl: row.preview_audio_url ?? undefined,
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const languages = request.nextUrl.searchParams
      .getAll("languages")
      .map((language) => language.trim())
      .filter(Boolean)

    let query = supabase
      .from("voices")
      .select(
        "provider, provider_voice_id, display_name, description, lang_code, tags, source, name, model, preview_text, preview_audio_url"
      )
      .eq("provider", "inworld")
      .eq("is_active", true)
      .order("source", { ascending: true, nullsFirst: false })
      .order("display_name", { ascending: true })

    if (languages.length > 0) {
      query = query.in("lang_code", languages)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to load voice catalog",
          message: error.message,
        },
        { status: 500 }
      )
    }

    const voices = Array.isArray(data)
      ? (data as VoiceRow[]).map(mapVoiceRow)
      : []

    return NextResponse.json({ voices })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load Inworld voices",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
