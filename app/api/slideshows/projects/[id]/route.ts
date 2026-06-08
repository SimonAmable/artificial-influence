import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getSlideshowProject,
  updateSlideshowProject,
} from "@/lib/slideshows/database-server"
import { updateSlideshowProjectSchema } from "@/lib/slideshows/types"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const project = await getSlideshowProject(supabase, user.id, id)
  return project
    ? NextResponse.json({ project })
    : NextResponse.json({ error: "Slideshow not found" }, { status: 404 })
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const parsed = updateSlideshowProjectSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    const project = await updateSlideshowProject(supabase, user.id, id, {
      ...parsed.data,
      status: parsed.data.slides
        ? parsed.data.slides.every((slide) => slide.status === "ready")
          ? "ready"
          : "resolving"
        : undefined,
    })
    return NextResponse.json({ project })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update slideshow." }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { error } = await supabase.from("slideshow_projects").delete().eq("id", id).eq("user_id", user.id)
  return error
    ? NextResponse.json({ error: error.message }, { status: 500 })
    : NextResponse.json({ ok: true })
}
