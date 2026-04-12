import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const { data: jobs, error } = await supabase
      .from("autopost_jobs")
      .select(
        "id, media_url, caption, media_type, status, scheduled_at, published_at, created_at, updated_at, last_error, provider_publish_id, provider_container_id"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      console.error("[autopost/jobs] GET failed:", error)
      return NextResponse.json({ error: "Failed to load posts." }, { status: 500 })
    }

    return NextResponse.json({ jobs: jobs ?? [] })
  } catch (error) {
    console.error("[autopost/jobs] GET exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
