import { NextResponse } from "next/server"

import { enhanceScriptForInworldTts } from "@/lib/prompt-enhancement"
import { createClient } from "@/lib/supabase/server"

const MAX_CHARS = 12_000

export async function POST(req: Request) {
  try {
    if (!process.env.AI_GATEWAY_API_KEY) {
      return NextResponse.json(
        { error: "AI_GATEWAY_API_KEY is not configured" },
        { status: 500 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      )
    }

    const body = await req.json()
    const text = typeof body.text === "string" ? body.text.trim() : ""

    if (!text) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      )
    }

    if (text.length > MAX_CHARS) {
      return NextResponse.json(
        { error: `Text must be at most ${MAX_CHARS} characters` },
        { status: 400 }
      )
    }

    const enhanced = await enhanceScriptForInworldTts(text)

    if (!enhanced) {
      return NextResponse.json(
        { error: "Enhancement returned empty text" },
        { status: 502 }
      )
    }

    return NextResponse.json({ text: enhanced })
  } catch (e) {
    console.error("[enhance-tts-script]", e)
    const message = e instanceof Error ? e.message : "Enhancement failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
