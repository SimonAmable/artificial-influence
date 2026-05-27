import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  deleteTemplate,
  getTemplateById,
  updateTemplate,
} from "@/lib/templates/database-server"
import {
  updateTemplateBodySchema,
  validatePromptPlaceholders,
  validateTemplateInputsUnique,
} from "@/lib/templates/validation"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const template = await getTemplateById(id, user?.id)
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error("[templates/id] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch template" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const existing = await getTemplateById(id, user.id)
    if (!existing || existing.creator_id !== user.id) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateTemplateBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const nextInputs = parsed.data.inputs ?? existing.inputs
    const nextPrompt = parsed.data.prompt ?? existing.prompt

    if (parsed.data.inputs) {
      const duplicateError = validateTemplateInputsUnique(parsed.data.inputs)
      if (duplicateError) {
        return NextResponse.json({ error: duplicateError }, { status: 400 })
      }
    }

    const placeholderError = validatePromptPlaceholders(nextPrompt, nextInputs)
    if (placeholderError) {
      return NextResponse.json({ error: placeholderError }, { status: 400 })
    }

    const nextVisibility = parsed.data.visibility ?? existing.visibility
    const nextThumbnail = parsed.data.thumbnail_url ?? existing.thumbnail_url
    if (nextVisibility === "public" && !nextThumbnail) {
      return NextResponse.json(
        { error: "Thumbnail is required to publish a public template" },
        { status: 400 },
      )
    }

    const template = await updateTemplate(id, user.id, parsed.data)
    return NextResponse.json({ template })
  } catch (error) {
    console.error("[templates/id] PATCH error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update template" },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await deleteTemplate(id, user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[templates/id] DELETE error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete template" },
      { status: 500 },
    )
  }
}
