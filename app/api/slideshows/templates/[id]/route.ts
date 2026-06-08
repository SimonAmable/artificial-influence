import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getSlideshowTemplate,
  updateSlideshowTemplate,
} from "@/lib/slideshows/database-server"
import { updateSlideshowTemplateSchema } from "@/lib/slideshows/types"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const template = await getSlideshowTemplate(supabase, user.id, id)
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 })
    return NextResponse.json({ template })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load template." },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const parsed = updateSlideshowTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const template = await updateSlideshowTemplate(supabase, user.id, id, parsed.data)
    return NextResponse.json({ template })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update template." },
      { status: 500 },
    )
  }
}
