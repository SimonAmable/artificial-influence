import { NextResponse } from "next/server"
import { isValidSkillSlug } from "@/lib/chat/skills/skill-md"
import { loadPinnedSkillSummariesForUser } from "@/lib/chat/skills/pins"
import { createClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params

    if (!isValidSkillSlug(slug)) {
      return NextResponse.json({ error: "Invalid skill slug." }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { error } = await supabase
      .from("user_pinned_skills")
      .delete()
      .eq("user_id", user.id)
      .eq("skill_slug", slug)

    if (error) {
      console.error("[skills/pins/:slug] DELETE:", error.message)
      return NextResponse.json({ error: "Could not unpin skill." }, { status: 500 })
    }

    const pinnedSkills = await loadPinnedSkillSummariesForUser(supabase, user.id)
    return NextResponse.json({ pinnedSkills })
  } catch (error) {
    console.error("[skills/pins/:slug] DELETE exception:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
