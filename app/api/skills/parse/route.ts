import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { normalizeSkillDocumentText } from "@/lib/chat/skills/normalize-skill-upload"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const text = typeof body.text === "string" ? body.text : ""

    const normalized = normalizeSkillDocumentText(text)
    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error }, { status: 400 })
    }

    return NextResponse.json({
      skillDocument: normalized.skillDocument,
      slug: normalized.slug,
      description: normalized.description,
      body: normalized.body,
    })
  } catch (error) {
    console.error("[skills/parse] POST exception:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
