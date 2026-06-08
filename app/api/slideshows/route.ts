import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listSlideshowProjects } from "@/lib/slideshows/database-server"
import { createAndResolveSlideshow } from "@/lib/slideshows/service"
import { createSlideshowRequestSchema } from "@/lib/slideshows/types"

export const maxDuration = 800

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ projects: await listSlideshowProjects(supabase, user.id) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load slideshows." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const parsed = createSlideshowRequestSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    const project = await createAndResolveSlideshow(supabase, user.id, parsed.data)
    return NextResponse.json({ project })
  } catch (error) {
    console.error("[slideshows] POST:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create slideshow." }, { status: 500 })
  }
}

