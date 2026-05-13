import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { loadSkillsCatalogForPicker } from "@/lib/chat/skills/catalog"
import { loadPinnedSkillSlugsForUser } from "@/lib/chat/skills/pins"
import { normalizeSkillDocumentText } from "@/lib/chat/skills/normalize-skill-upload"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pinnedSlugs = await loadPinnedSkillSlugsForUser(supabase, user.id)
  const skills = await loadSkillsCatalogForPicker(supabase, user.id, pinnedSlugs)
  return Response.json({ skills })
}

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
    const skillDocumentRaw = typeof body.skillDocument === "string" ? body.skillDocument : ""

    const normalized = normalizeSkillDocumentText(skillDocumentRaw)
    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error }, { status: 400 })
    }

    const { error } = await supabase.from("skills").upsert(
      {
        user_id: user.id,
        slug: normalized.slug,
        title: null,
        skill_document: normalized.skillDocument,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,slug" },
    )

    if (error) {
      console.error("[skills] POST upsert:", error.message)
      return NextResponse.json({ error: "Could not save skill." }, { status: 500 })
    }

    const pinnedSlugs = await loadPinnedSkillSlugsForUser(supabase, user.id)
    const skills = await loadSkillsCatalogForPicker(supabase, user.id, pinnedSlugs)

    return NextResponse.json({
      skill: {
        slug: normalized.slug,
        description: normalized.description,
        title: null as string | null,
      },
      skills,
    })
  } catch (error) {
    console.error("[skills] POST exception:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
