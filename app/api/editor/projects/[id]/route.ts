import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { editorProjectSchema } from "@/lib/video-editor/types"

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
    .from("editor_projects")
    .select("id, name, state_json, updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()
  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(data)
}

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = (await req.json()) as { name?: string; state_json?: unknown }
  let validatedState: ReturnType<typeof editorProjectSchema.parse> | undefined
  if (body.state_json !== undefined) {
    const parsed = editorProjectSchema.safeParse(body.state_json)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid project state" }, { status: 400 })
    }
    validatedState = parsed.data
  }
  const { error } = await supabase
    .from("editor_projects")
    .update({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(validatedState !== undefined ? { state_json: validatedState } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { error } = await supabase.from("editor_projects").delete().eq("id", id).eq("user_id", user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
