import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  deleteStudioProject,
  getStudioProject,
  updateStudioProject,
} from "@/lib/studio/database-server"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const { id } = await params
    const project = await getStudioProject(supabase, user.id, id)
    if (!project) {
      return NextResponse.json({ error: "Studio project not found" }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error("[GET /api/studio/projects/:id]", error)
    return NextResponse.json({ error: "Failed to load studio project" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const project = await updateStudioProject(supabase, user.id, id, body)
    return NextResponse.json(project)
  } catch (error) {
    console.error("[PATCH /api/studio/projects/:id]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update studio project" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const { id } = await params
    await deleteStudioProject(supabase, user.id, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[DELETE /api/studio/projects/:id]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete studio project" },
      { status: 500 },
    )
  }
}
