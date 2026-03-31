import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createEditorProject,
  listEditorProjects,
} from "@/lib/editor/database-server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      )
    }

    const projects = await listEditorProjects(user.id)
    return NextResponse.json(projects)
  } catch (error) {
    console.error("Error fetching editor projects:", error)
    return NextResponse.json(
      { error: "Failed to fetch editor projects" },
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
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      )
    }

    const body = await request.json()
    const project = await createEditorProject(user.id, body)
    return NextResponse.json(project)
  } catch (error) {
    console.error("Error creating editor project:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create editor project",
      },
      { status: 500 },
    )
  }
}
