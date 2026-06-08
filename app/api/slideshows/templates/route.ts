import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  cloneSlideshowTemplate,
  createSlideshowTemplate,
  getSlideshowTemplate,
  listSlideshowTemplates,
} from "@/lib/slideshows/database-server"
import { createSlideshowTemplateSchema } from "@/lib/slideshows/types"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ templates: await listSlideshowTemplates(supabase, user.id) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load templates." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const body = await request.json().catch(() => ({}))

    if (typeof body.templateId === "string") {
      const source = await getSlideshowTemplate(supabase, user.id, body.templateId)
      if (!source) return NextResponse.json({ error: "Template not found" }, { status: 404 })
      return NextResponse.json({ template: await cloneSlideshowTemplate(supabase, user.id, source) })
    }

    const parsed = createSlideshowTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const template = await createSlideshowTemplate(supabase, user.id, {
      name: parsed.data.name,
      description: parsed.data.description,
      aspectRatio: parsed.data.aspectRatio,
      blueprint: parsed.data.blueprint,
      origin: parsed.data.origin ?? "saved",
    })
    return NextResponse.json({ template })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to clone template." }, { status: 500 })
  }
}

