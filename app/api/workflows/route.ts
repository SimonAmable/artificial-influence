import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createWorkflow, listUserWorkflows } from "@/lib/workflows/database-server"

/**
 * GET /api/workflows
 * List all workflows for the authenticated user (own + public)
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

    const workflows = await listUserWorkflows(user.id)
    
    return NextResponse.json(workflows)
  } catch (error) {
    console.error("Error fetching workflows:", error)
    return NextResponse.json(
      { error: "Failed to fetch workflows" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workflows
 * Create a new workflow from selected group nodes
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    if (!body.name || !body.nodes || !Array.isArray(body.nodes)) {
      return NextResponse.json(
        { error: "Missing required fields: name, nodes" },
        { status: 400 }
      )
    }
    
    const workflow = await createWorkflow(user.id, {
      name: body.name,
      description: body.description || null,
      thumbnail_url: body.thumbnail_url || null,
      nodes: body.nodes,
      edges: body.edges || [],
      is_public: false, // Default to private when saving
    })

    return NextResponse.json(workflow)
  } catch (error) {
    console.error("Error creating workflow:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create workflow" },
      { status: 500 }
    )
  }
}
