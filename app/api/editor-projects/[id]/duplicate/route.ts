import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { duplicateEditorProject } from "@/lib/editor/database-server"

export async function POST(
  request: Request,
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
    const project = await duplicateEditorProject(id, user.id)
    return NextResponse.json(project)
  } catch (error) {
    console.error("Error duplicating editor project:", error)
    return NextResponse.json(
      { error: "Failed to duplicate editor project" },
      { status: 500 },
    )
  }
}
