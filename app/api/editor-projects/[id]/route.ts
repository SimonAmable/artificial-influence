import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  deleteEditorProject,
  loadEditorProject,
  updateEditorProject,
} from "@/lib/editor/database-server"

export async function GET(
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
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      )
    }

    const { id } = await params
    const project = await loadEditorProject(id, user.id)
    if (!project) {
      return NextResponse.json(
        { error: "Editor project not found" },
        { status: 404 },
      )
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error("Error loading editor project:", error)
    return NextResponse.json(
      { error: "Failed to load editor project" },
      { status: 500 },
    )
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
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      )
    }

    const body = await request.json()
    const { id } = await params
    const project = await updateEditorProject(id, user.id, body)
    return NextResponse.json(project)
  } catch (error) {
    console.error("Error updating editor project:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update editor project",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(
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
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      )
    }

    const { id } = await params
    await deleteEditorProject(id, user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting editor project:", error)
    return NextResponse.json(
      { error: "Failed to delete editor project" },
      { status: 500 },
    )
  }
}
