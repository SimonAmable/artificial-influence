import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  deleteStudioBoardItem,
  updateStudioBoardItem,
} from "@/lib/studio/database-server"
import type { UpdateStudioBoardItemInput } from "@/lib/studio/types"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
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

    const { id, itemId } = await params
    const body = (await request.json().catch(() => ({}))) as UpdateStudioBoardItemInput
    const item = await updateStudioBoardItem(supabase, user.id, id, itemId, body)
    return NextResponse.json(item)
  } catch (error) {
    console.error("[PATCH /api/studio/projects/:id/items/:itemId]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update board item" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
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

    const { id, itemId } = await params
    await deleteStudioBoardItem(supabase, user.id, id, itemId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[DELETE /api/studio/projects/:id/items/:itemId]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete board item" },
      { status: 500 },
    )
  }
}
