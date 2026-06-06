import { waitUntil } from "@vercel/functions"
import { NextResponse } from "next/server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { validateFfmpegTextOverlayProject } from "@/lib/video-editor/ffmpeg-ass"
import {
  assertCanStartFfmpegOverlayRender,
  startFfmpegOverlayRenderInBackground,
} from "@/lib/video-editor/ffmpeg-sandbox-render"
import { EDITOR_RENDER_RUNNER } from "@/lib/video-editor/render-jobs"
import { editorProjectSchema } from "@/lib/video-editor/types"

export const runtime = "nodejs"
export const maxDuration = 800

type QueueTextOverlayRenderRequest = {
  projectId?: string
  userId?: string
}

function verifyInternalAuth(req: Request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`
}

export async function POST(req: Request) {
  if (!verifyInternalAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as QueueTextOverlayRenderRequest
  if (!body.projectId || !body.userId) {
    return NextResponse.json({ error: "Missing projectId or userId" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  const { data: projectRow, error: projectError } = await supabase
    .from("editor_projects")
    .select("id, name, state_json")
    .eq("id", body.projectId)
    .eq("user_id", body.userId)
    .single()

  if (projectError || !projectRow) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const projectState = {
    ...(typeof projectRow.state_json === "object" && projectRow.state_json !== null
      ? projectRow.state_json
      : {}),
    id: projectRow.id,
    name: projectRow.name,
  }
  const parsedProject = editorProjectSchema.safeParse(projectState)
  if (!parsedProject.success) {
    return NextResponse.json(
      { error: "Project state is invalid and cannot be rendered" },
      { status: 400 }
    )
  }

  try {
    assertCanStartFfmpegOverlayRender()
    validateFfmpegTextOverlayProject(parsedProject.data)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "FFmpeg text overlay rendering is not configured",
      },
      { status: 400 }
    )
  }

  const { data: renderJob, error: insertError } = await supabase
    .from("editor_render_jobs")
    .insert({
      user_id: body.userId,
      project_id: projectRow.id,
      status: "queued",
      progress: 0,
      project_snapshot: parsedProject.data,
      request_payload: {
        runner: EDITOR_RENDER_RUNNER,
        engine: "ffmpeg-ass",
        codec: "h264",
        container: "mp4",
        queued_from: "chat-agent",
      },
    })
    .select("id")
    .single()

  if (insertError || !renderJob) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create render job" },
      { status: 500 }
    )
  }

  waitUntil(
    startFfmpegOverlayRenderInBackground({
      renderJobId: renderJob.id,
      project: parsedProject.data,
    })
  )

  return NextResponse.json({ jobId: renderJob.id })
}
