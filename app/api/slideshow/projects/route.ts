import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createSlideshowProject,
  listSlideshowProjects,
} from "@/lib/slideshow/database-server"
import { createSlideshowProjectSchema } from "@/lib/slideshow/types"

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

    const projects = await listSlideshowProjects(supabase, user.id)
    return NextResponse.json({ projects })
  } catch (error) {
    console.error("[slideshow/projects] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load slideshow projects." },
      { status: 500 },
    )
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

    const body = await request.json().catch(() => ({}))
    const parsed = createSlideshowProjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const project = await createSlideshowProject(supabase, user.id, parsed.data)
    return NextResponse.json({ project })
  } catch (error) {
    console.error("[slideshow/projects] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create slideshow project." },
      { status: 500 },
    )
  }
}
