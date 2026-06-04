import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createTemplate,
  listTemplatesForGallery,
  listUserTemplates,
} from "@/lib/templates/database-server"
import {
  createTemplateBodySchema,
  validatePromptPlaceholders,
  validateTemplateInputsUnique,
} from "@/lib/templates/validation"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const scope = request.nextUrl.searchParams.get("scope")
    const category = request.nextUrl.searchParams.get("category") ?? undefined
    const search = request.nextUrl.searchParams.get("search") ?? undefined

    if (scope === "mine") {
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      const templates = await listUserTemplates(user.id)
      return NextResponse.json({ templates })
    }

    const templates = await listTemplatesForGallery(user?.id ?? null, category, search)
    return NextResponse.json({ templates })
  } catch (error) {
    console.error("[templates] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list templates" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createTemplateBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const duplicateError = validateTemplateInputsUnique(parsed.data.inputs)
    if (duplicateError) {
      return NextResponse.json({ error: duplicateError }, { status: 400 })
    }

    const placeholderError = validatePromptPlaceholders(parsed.data.prompt, parsed.data.inputs)
    if (placeholderError) {
      return NextResponse.json({ error: placeholderError }, { status: 400 })
    }

    if (parsed.data.visibility === "public" && !parsed.data.thumbnail_url) {
      return NextResponse.json(
        { error: "Thumbnail is required to publish a public template" },
        { status: 400 },
      )
    }

    const template = await createTemplate(user.id, parsed.data)
    return NextResponse.json({ template })
  } catch (error) {
    console.error("[templates] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create template" },
      { status: 500 },
    )
  }
}
