import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getEditorAgentSession,
  saveEditorAgentSession,
} from "@/lib/editor/database-server"

export async function GET(request: NextRequest) {
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

    const projectId = request.nextUrl.searchParams.get("projectId")
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    const session = await getEditorAgentSession(projectId, user.id)
    return NextResponse.json(session)
  } catch (error) {
    console.error("Error loading editor agent session:", error)
    return NextResponse.json(
      { error: "Failed to load editor agent session" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
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
    if (!body.projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    const session = await saveEditorAgentSession(body.projectId, user.id, {
      messages: body.messages,
      pending_action: body.pending_action,
      command_history: body.command_history,
    })
    return NextResponse.json(session)
  } catch (error) {
    console.error("Error saving editor agent session:", error)
    return NextResponse.json(
      { error: "Failed to save editor agent session" },
      { status: 500 },
    )
  }
}
