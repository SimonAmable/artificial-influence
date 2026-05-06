import { NextRequest, NextResponse } from "next/server"

import {
  buildFallbackGoogleGeminiVoices,
  type AudioProvider,
} from "@/lib/constants/audio"
import { isAudioProvider } from "@/lib/server/audio-tts"
import { listCatalogVoices } from "@/lib/server/audio-voices"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const requestedProvider = request.nextUrl.searchParams.get("provider")?.trim()
  const provider: AudioProvider =
    requestedProvider && isAudioProvider(requestedProvider)
      ? requestedProvider
      : "inworld"
  const languages = request.nextUrl.searchParams
    .getAll("languages")
    .map((language) => language.trim())
    .filter(Boolean)

  try {
    const supabase = await createClient()
    const voices = await listCatalogVoices(supabase, { provider, languages })

    return NextResponse.json({ voices })
  } catch (error) {
    if (provider === "google") {
      const fallbackVoices = buildFallbackGoogleGeminiVoices().filter((voice) =>
        languages.length > 0 ? languages.includes(voice.langCode) : true
      )

      return NextResponse.json({
        voices: fallbackVoices,
        degraded: true,
        warning: error instanceof Error ? error.message : "Unknown error",
      })
    }

    return NextResponse.json(
      {
        error: "Failed to load voice catalog",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
