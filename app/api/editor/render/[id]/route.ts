import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  mapEditorRenderJobRowToResponse,
  type EditorRenderJobRow,
} from "@/lib/video-editor/render-jobs"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("editor_render_jobs")
    .select("id, status, progress, output_url, error_message")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Render job not found" }, { status: 404 })
  }

  return NextResponse.json(
    mapEditorRenderJobRowToResponse(data as EditorRenderJobRow)
  )
}
