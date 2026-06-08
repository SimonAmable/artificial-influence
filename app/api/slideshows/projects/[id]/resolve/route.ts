import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveSlideshowProject } from "@/lib/slideshows/resolver"

export const maxDuration = 800
type Context = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: Context) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ project: await resolveSlideshowProject(supabase, user.id, id) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to resolve slideshow." }, { status: 500 })
  }
}

