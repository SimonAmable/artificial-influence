import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createCanvas, listUserCanvases } from "@/lib/canvas/database-server"

/**
 * GET /api/canvases
 * List all canvases for the authenticated user
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      )
    }

    const canvases = await listUserCanvases(user.id)
    
    return NextResponse.json(canvases)
  } catch (error) {
    console.error("Error fetching canvases:", error)
    return NextResponse.json(
      { error: "Failed to fetch canvases" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/canvases
 * Create a new canvas
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[POST /api/canvases] Starting canvas creation...')
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[POST /api/canvases] Auth error:', authError)
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      )
    }

    console.log('[POST /api/canvases] User authenticated:', user.id)
    const body = await request.json()
    console.log('[POST /api/canvases] Request body:', JSON.stringify(body))
    
    const canvas = await createCanvas(user.id, {
      name: body.name || "Canvas",
      description: body.description || null,
      nodes: body.nodes || [],
      edges: body.edges || [],
    })

    console.log('[POST /api/canvases] Canvas created successfully:', canvas.id)
    return NextResponse.json(canvas)
  } catch (error) {
    console.error("[POST /api/canvases] Error creating canvas:", error)
    console.error("[POST /api/canvases] Error stack:", error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create canvas" },
      { status: 500 }
    )
  }
}
