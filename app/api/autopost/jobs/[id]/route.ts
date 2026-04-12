import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobId } = await context.params
    const trimmed = jobId?.trim() ?? ""
    if (!trimmed) {
      return NextResponse.json({ error: "Invalid job id." }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const { data: job, error: fetchError } = await supabase
      .from("autopost_jobs")
      .select("id, status")
      .eq("id", trimmed)
      .eq("user_id", user.id)
      .maybeSingle()

    if (fetchError || !job) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 })
    }

    if (job.status !== "draft" && job.status !== "queued") {
      return NextResponse.json(
        { error: "Only drafts and scheduled posts can be cancelled." },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase
      .from("autopost_jobs")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", trimmed)
      .eq("user_id", user.id)
      .in("status", ["draft", "queued"])

    if (updateError) {
      console.error("[autopost/jobs] DELETE update failed:", updateError)
      return NextResponse.json({ error: "Failed to cancel post." }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[autopost/jobs] DELETE exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
