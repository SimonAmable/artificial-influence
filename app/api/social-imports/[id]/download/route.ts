import { NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"

import { processSocialReferenceDownloadJob } from "@/lib/social-imports/jobs"
import { detectLegacyDownloadPlatform } from "@/lib/social-imports/registry"
import { SOCIAL_MEDIA_IMPORTS_TABLE } from "@/lib/social-imports/types"
import { createClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ id: string }>
}

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(_request: Request, context: RouteContext) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Sign in to download." }, { status: 401 })
    }

    const { id } = await context.params
    const { data: row, error } = await supabase
      .from(SOCIAL_MEDIA_IMPORTS_TABLE)
      .select("id, source_url, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (error || !row) {
      return NextResponse.json({ error: "Import not found." }, { status: 404 })
    }

    const sourceUrl = String(row.source_url)
    try {
      detectLegacyDownloadPlatform(sourceUrl)
    } catch (validationError) {
      return NextResponse.json(
        { error: validationError instanceof Error ? validationError.message : "Invalid URL." },
        { status: 400 },
      )
    }

    if (row.status === "completed" || row.status === "ready") {
      return NextResponse.json({ importId: row.id, status: row.status })
    }

    const { error: updateError } = await supabase
      .from(SOCIAL_MEDIA_IMPORTS_TABLE)
      .update({ status: "queued", import_purpose: "reference_download" })
      .eq("id", id)
      .eq("user_id", user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    waitUntil(processSocialReferenceDownloadJob(id))

    return NextResponse.json({ jobId: id }, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}