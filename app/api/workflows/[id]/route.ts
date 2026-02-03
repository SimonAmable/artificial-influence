import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getWorkflow, updateWorkflow, deleteWorkflow, uploadWorkflowThumbnail } from "@/lib/workflows/database-server"

/**
 * GET /api/workflows/[id]
 * Get a single workflow by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      )
    }

    const workflow = await getWorkflow(id, user.id)
    return NextResponse.json(workflow)
  } catch (error) {
    console.error("Error fetching workflow:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch workflow" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/workflows/[id]
 * Update workflow metadata (name, description, is_public, thumbnail_url)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    const workflow = await updateWorkflow(id, user.id, {
      name: body.name,
      description: body.description,
      thumbnail_url: body.thumbnail_url,
      is_public: body.is_public,
    })

    return NextResponse.json(workflow)
  } catch (error) {
    console.error("Error updating workflow:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update workflow" },
      { status: error instanceof Error && error.message.includes("access denied") ? 403 : 500 }
    )
  }
}

/**
 * DELETE /api/workflows/[id]
 * Delete a workflow
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      )
    }

    await deleteWorkflow(id, user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting workflow:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete workflow" },
      { status: error instanceof Error && error.message.includes("access denied") ? 403 : 500 }
    )
  }
}
