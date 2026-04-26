import { NextResponse } from "next/server"
import {
  buildSkillDocument,
  MAX_SKILL_BODY_CHARS,
  MAX_SKILL_DESCRIPTION_LENGTH,
  isValidSkillSlug,
  parseSkillDocument,
} from "@/lib/chat/skills/skill-md"
import { createClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ slug: string }>
}

function normalizeTitle(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  return trimmed.slice(0, 200)
}

function mapEditableSkill(row: { slug: string; skill_document: string; title: string | null }) {
  const parsed = parseSkillDocument(row.skill_document)

  return {
    description: parsed.description,
    instructionsBody: parsed.body,
    slug: row.slug,
    title: row.title ?? "",
  }
}

export async function GET(_request: Request, context: RouteContext) {
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

    const { data, error } = await supabase
      .from("skills")
      .select("slug, title, skill_document")
      .eq("user_id", user.id)
      .eq("slug", slug)
      .maybeSingle()

    if (error) {
      console.error("[skills] GET skill:", error.message)
      return NextResponse.json({ error: "Could not load skill." }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "Skill not found." }, { status: 404 })
    }

    return NextResponse.json({ skill: mapEditableSkill(data) })
  } catch (error) {
    console.error("[skills] GET skill exception:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const description = typeof body.description === "string" ? body.description.trim() : ""
    const instructionsBody = typeof body.instructionsBody === "string" ? body.instructionsBody.trim() : ""
    const title = normalizeTitle(body.title)

    if (!description) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 })
    }

    if (description.length > MAX_SKILL_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: `Description must be ${MAX_SKILL_DESCRIPTION_LENGTH} characters or fewer.` },
        { status: 400 },
      )
    }

    if (!instructionsBody) {
      return NextResponse.json({ error: "Instructions are required." }, { status: 400 })
    }

    if (instructionsBody.length > MAX_SKILL_BODY_CHARS) {
      return NextResponse.json(
        { error: `Instructions must be ${MAX_SKILL_BODY_CHARS} characters or fewer.` },
        { status: 400 },
      )
    }

    const skillDocument = buildSkillDocument(slug, description, instructionsBody)

    const { data, error } = await supabase
      .from("skills")
      .update({
        skill_document: skillDocument,
        title,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("slug", slug)
      .select("slug, title, skill_document")
      .maybeSingle()

    if (error) {
      console.error("[skills] PATCH skill:", error.message)
      return NextResponse.json({ error: "Could not save skill." }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "Skill not found." }, { status: 404 })
    }

    return NextResponse.json({ skill: mapEditableSkill(data) })
  } catch (error) {
    console.error("[skills] PATCH skill exception:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
