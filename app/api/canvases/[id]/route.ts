import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { loadCanvas, updateCanvas, deleteCanvas } from "@/lib/canvas/database-server"

/**
 * GET /api/canvases/[id]
 * Load a specific canvas
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      )
    }

    const { id } = await params
    const canvas = await loadCanvas(id, user.id)

    if (!canvas) {
      return NextResponse.json(
        { error: "Canvas not found" },
        { status: 404 }
      )
    }

    console.log('[GET /api/canvases/[id]] Loading canvas:', id)
    console.log('[GET /api/canvases/[id]] Edges count:', canvas.edges?.length || 0)
    console.log('[GET /api/canvases/[id]] Edges:', JSON.stringify(canvas.edges || []))

    return NextResponse.json(canvas)
  } catch (error) {
    console.error("Error loading canvas:", error)
    return NextResponse.json(
      { error: "Failed to load canvas" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/canvases/[id]
 * Update an existing canvas
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    
    console.log('[PATCH /api/canvases/[id]] Updating canvas:', id)
    console.log('[PATCH /api/canvases/[id]] Edges count:', body.edges?.length || 0)
    console.log('[PATCH /api/canvases/[id]] Edges:', JSON.stringify(body.edges || []))
    
    const canvas = await updateCanvas(id, user.id, body)
    
    console.log('[PATCH /api/canvases/[id]] Returned edges count:', canvas.edges?.length || 0)
    console.log('[PATCH /api/canvases/[id]] Returned edges:', JSON.stringify(canvas.edges || []))

    return NextResponse.json(canvas)
  } catch (error) {
    console.error("Error updating canvas:", error)
    return NextResponse.json(
      { error: "Failed to update canvas" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/canvases/[id]
 * Delete a canvas
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      )
    }

    const { id } = await params
    await deleteCanvas(id, user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting canvas:", error)
    return NextResponse.json(
      { error: "Failed to delete canvas" },
      { status: 500 }
    )
  }
}
