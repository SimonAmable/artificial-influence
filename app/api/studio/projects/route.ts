import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createStudioProject,
  listStudioProjects,
} from "@/lib/studio/database-server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const projects = await listStudioProjects(supabase, user.id)
    return NextResponse.json(projects)
  } catch (error) {
    console.error("[GET /api/studio/projects]", error)
    return NextResponse.json({ error: "Failed to fetch studio projects" }, { status: 500 })
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
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string
      viewport?: { x: number; y: number; zoom: number }
    }

    const project = await createStudioProject(supabase, user.id, {
      name: body.name,
      viewport: body.viewport,
    })

    return NextResponse.json(project)
  } catch (error) {
    console.error("[POST /api/studio/projects]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create studio project" },
      { status: 500 },
    )
  }
}
