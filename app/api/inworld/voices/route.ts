import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { listInworldVoices } from "@/lib/server/inworld-tts"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to browse voices." },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const languages = searchParams.getAll("languages")
    const voices = await listInworldVoices(languages)

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
