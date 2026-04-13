import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

type IgEmbed = { instagram_username: string | null }

type JobRow = {
  id: string
  media_url: string
  caption: string | null
  media_type: string
  metadata: unknown
  status: string
  scheduled_at: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  last_error: string | null
  provider_publish_id: string | null
  provider_container_id: string | null
  instagram_connection_id: string | null
  /** PostgREST may return object or single-element array for nested embeds. */
  instagram_connections: IgEmbed | IgEmbed[] | null
}

function resolveInstagramUsername(embed: JobRow["instagram_connections"]): string | null {
  if (!embed) {
    return null
  }
  if (Array.isArray(embed)) {
    return embed[0]?.instagram_username ?? null
  }
  return embed.instagram_username ?? null
}

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

    const { data: rawJobs, error } = await supabase
      .from("autopost_jobs")
      .select(
        "id, media_url, caption, media_type, metadata, status, scheduled_at, published_at, created_at, updated_at, last_error, provider_publish_id, provider_container_id, instagram_connection_id, instagram_connections!instagram_connection_id ( instagram_username )"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      console.error("[autopost/jobs] GET failed:", error)
      return NextResponse.json({ error: "Failed to load posts." }, { status: 500 })
    }

    const jobs = (rawJobs ?? []).map((row) => {
      const j = row as JobRow
      return {
        id: j.id,
        media_url: j.media_url,
        caption: j.caption,
        media_type: j.media_type,
        metadata: j.metadata ?? null,
        status: j.status,
        scheduled_at: j.scheduled_at,
        published_at: j.published_at,
        created_at: j.created_at,
        updated_at: j.updated_at,
        last_error: j.last_error,
        provider_publish_id: j.provider_publish_id,
        provider_container_id: j.provider_container_id,
        instagram_connection_id: j.instagram_connection_id,
        instagram_username: resolveInstagramUsername(j.instagram_connections),
      }
    })

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error("[autopost/jobs] GET exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
