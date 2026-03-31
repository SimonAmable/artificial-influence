import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createEditorRenderJob,
  updateEditorProject,
  updateEditorRenderJob,
} from "@/lib/editor/database-server"

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
    const job = await createEditorRenderJob(id, user.id, {
      mode: "stub",
      requestedAt: new Date().toISOString(),
    })

    const message =
      "Render adapter not configured yet. Project saving and queue creation are live, but final Remotion export still needs provider credentials or a worker."

    const failed = await updateEditorRenderJob(job.id, user.id, {
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString(),
    })

    await updateEditorProject(id, user.id, {
      last_render_status: "failed",
      last_rendered_at: new Date().toISOString(),
    })

    return NextResponse.json(failed)
  } catch (error) {
    console.error("Error creating editor render job:", error)
    return NextResponse.json(
      { error: "Failed to create editor render job" },
      { status: 500 },
    )
  }
}
