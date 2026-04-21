import { NextRequest, NextResponse } from "next/server"

import type { AudioProvider } from "@/lib/constants/audio"
import { isAudioProvider } from "@/lib/server/audio-tts"
import { listCatalogVoices } from "@/lib/server/audio-voices"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const requestedProvider = request.nextUrl.searchParams.get("provider")?.trim()
    const provider: AudioProvider =
      requestedProvider && isAudioProvider(requestedProvider)
        ? requestedProvider
        : "inworld"

    const languages = request.nextUrl.searchParams
      .getAll("languages")
      .map((language) => language.trim())
      .filter(Boolean)

    const supabase = await createClient()
    const voices = await listCatalogVoices(supabase, { provider, languages })

    return NextResponse.json({ voices })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load voice catalog",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
