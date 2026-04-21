import { NextRequest, NextResponse } from "next/server"

import { listCatalogVoices } from "@/lib/server/audio-voices"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const languages = request.nextUrl.searchParams
      .getAll("languages")
      .map((language) => language.trim())
      .filter(Boolean)

    const voices = await listCatalogVoices(supabase, {
      provider: "inworld",
      languages,
    })

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
