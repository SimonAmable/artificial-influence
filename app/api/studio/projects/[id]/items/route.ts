import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createStudioBoardItems,
  listStudioBoardItems,
} from "@/lib/studio/database-server"
import type { CreateStudioBoardItemInput } from "@/lib/studio/types"

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
    const items = await listStudioBoardItems(supabase, user.id, id)
    return NextResponse.json(items)
  } catch (error) {
    console.error("[GET /api/studio/projects/:id/items]", error)
    const message = error instanceof Error ? error.message : "Failed to load board items"
    const status = message === "Studio project not found" ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(
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
    const body = (await request.json().catch(() => ({}))) as {
      items?: CreateStudioBoardItemInput[]
    }
    const items = Array.isArray(body.items) ? body.items : []
    if (items.length === 0) {
      return NextResponse.json({ error: "No items to add" }, { status: 400 })
    }

    const created = await createStudioBoardItems(supabase, user.id, id, items)
    return NextResponse.json(created)
  } catch (error) {
    console.error("[POST /api/studio/projects/:id/items]", error)
    const message = error instanceof Error ? error.message : "Failed to add board items"
    const status = message === "Studio project not found" ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
