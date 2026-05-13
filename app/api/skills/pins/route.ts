import { NextResponse } from "next/server"
import { fetchSkillRowBySlug } from "@/lib/chat/skills/resolve-skill-row"
import { isValidSkillSlug } from "@/lib/chat/skills/skill-md"
import {
  loadPinnedSkillSlugsForUser,
  loadPinnedSkillSummariesForUser,
  MAX_PINNED_SKILLS,
} from "@/lib/chat/skills/pins"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const pinnedSkills = await loadPinnedSkillSummariesForUser(supabase, user.id)
    return NextResponse.json({ pinnedSkills })
  } catch (error) {
    console.error("[skills/pins] GET exception:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
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
    const slug = typeof body.slug === "string" ? body.slug.trim() : ""

    if (!isValidSkillSlug(slug)) {
      return NextResponse.json({ error: "Invalid skill slug." }, { status: 400 })
    }

    const visibleSkill = await fetchSkillRowBySlug(supabase, user.id, slug)
    if (!visibleSkill) {
      return NextResponse.json({ error: "Skill not found." }, { status: 404 })
    }

    const existingSlugs = await loadPinnedSkillSlugsForUser(supabase, user.id)
    if (!existingSlugs.includes(slug) && existingSlugs.length >= MAX_PINNED_SKILLS) {
      return NextResponse.json(
        { error: `You can pin up to ${MAX_PINNED_SKILLS} skills.` },
        { status: 400 },
      )
    }

    const { error } = await supabase.from("user_pinned_skills").upsert(
      {
        user_id: user.id,
        skill_slug: slug,
      },
      { onConflict: "user_id,skill_slug" },
    )

    if (error) {
      console.error("[skills/pins] POST:", error.message)
      return NextResponse.json({ error: "Could not pin skill." }, { status: 500 })
    }

    const pinnedSkills = await loadPinnedSkillSummariesForUser(supabase, user.id)
    return NextResponse.json({ pinnedSkills })
  } catch (error) {
    console.error("[skills/pins] POST exception:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
