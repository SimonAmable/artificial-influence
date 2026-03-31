import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getEditorRenderJob } from "@/lib/editor/database-server"

export async function GET(
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
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      )
    }

    const { id } = await params
    const job = await getEditorRenderJob(id, user.id)

    if (!job) {
      return NextResponse.json({ error: "Render job not found" }, { status: 404 })
    }

    return NextResponse.json(job)
  } catch (error) {
    console.error("Error fetching render job:", error)
    return NextResponse.json(
      { error: "Failed to fetch render job" },
      { status: 500 },
    )
  }
}
