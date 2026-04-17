import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { editorProjectSchema } from "@/lib/video-editor/types"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { data, error } = await supabase
    .from("editor_projects")
    .select("id, name, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ projects: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = (await req.json()) as { name?: string; state_json?: unknown }
  const parsed = editorProjectSchema.safeParse(body.state_json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project state" }, { status: 400 })
  }
  const { data, error } = await supabase
    .from("editor_projects")
    .insert({
      user_id: user.id,
      name: body.name ?? "Untitled Project",
      state_json: parsed.data,
    })
    .select("id")
    .single()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ id: data.id })
}
