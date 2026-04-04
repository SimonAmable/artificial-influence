import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getMiniAppById, updateMiniApp } from "@/lib/mini-apps/database-server"

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const miniApp = await getMiniAppById(id, user.id)
    return NextResponse.json(miniApp)
  } catch (error) {
    console.error("Error fetching mini app:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch mini app" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const body = await request.json()
    const miniApp = await updateMiniApp(id, user.id, {
      workflow_version: body.workflow_version,
      name: body.name,
      slug: body.slug,
      description: body.description,
      thumbnail_url: body.thumbnail_url,
      status: body.status,
      featured_output_node_id: body.featured_output_node_id,
      node_config: body.node_config,
      snapshot_nodes: body.snapshot_nodes,
      snapshot_edges: body.snapshot_edges,
    })

    return NextResponse.json(miniApp)
  } catch (error) {
    console.error("Error updating mini app:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update mini app" },
      { status: 500 }
    )
  }
}
