import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createMiniApp,
  getUserMiniAppByWorkflowId,
  listUserMiniApps,
} from "@/lib/mini-apps/database-server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const workflowId = request.nextUrl.searchParams.get("workflowId")
    if (workflowId) {
      const miniApp = await getUserMiniAppByWorkflowId(workflowId, user.id)
      if (!miniApp) {
        return NextResponse.json({ error: "Mini app not found" }, { status: 404 })
      }
      return NextResponse.json(miniApp)
    }

    const miniApps = await listUserMiniApps(user.id)
    return NextResponse.json(miniApps)
  } catch (error) {
    console.error("Error fetching mini apps:", error)
    return NextResponse.json({ error: "Failed to fetch mini apps" }, { status: 500 })
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

    const body = await request.json()
    if (
      !body.workflow_id ||
      !body.workflow_version ||
      !body.name ||
      !body.slug ||
      !body.node_config ||
      !Array.isArray(body.snapshot_nodes) ||
      !Array.isArray(body.snapshot_edges)
    ) {
      return NextResponse.json(
        { error: "Missing required fields for mini app publishing" },
        { status: 400 }
      )
    }

    const miniApp = await createMiniApp(user.id, {
      workflow_id: body.workflow_id,
      workflow_version: body.workflow_version,
      name: body.name,
      slug: body.slug,
      description: body.description ?? null,
      thumbnail_url: body.thumbnail_url ?? null,
      status: body.status ?? "published",
      featured_output_node_id: body.featured_output_node_id ?? null,
      node_config: body.node_config,
      snapshot_nodes: body.snapshot_nodes,
      snapshot_edges: body.snapshot_edges,
    })

    return NextResponse.json(miniApp)
  } catch (error) {
    console.error("Error creating mini app:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create mini app" },
      { status: 500 }
    )
  }
}
