import { NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"
import { createClient } from "@/lib/supabase/server"
import {
  EDITOR_RENDER_RUNNER,
} from "@/lib/video-editor/render-jobs"
import {
  assertCanStartRemotionRender,
  startRemotionRenderInBackground,
} from "@/lib/video-editor/remotion-vercel-render"
import { editorProjectSchema } from "@/lib/video-editor/types"

export const runtime = "nodejs"
export const maxDuration = 3600

type QueueRenderRequest = {
  projectId?: string
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

  const body = (await req.json().catch(() => ({}))) as QueueRenderRequest
  if (!body.projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 })
  }

  const { data: projectRow, error: projectError } = await supabase
    .from("editor_projects")
    .select("id, name, state_json")
    .eq("id", body.projectId)
    .eq("user_id", user.id)
    .single()

  if (projectError || !projectRow) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const projectState = {
    ...(typeof projectRow.state_json === "object" && projectRow.state_json !== null
      ? projectRow.state_json
      : {}),
    id: projectRow.id,
    name:
      typeof projectRow.state_json === "object" &&
      projectRow.state_json !== null &&
      "name" in projectRow.state_json &&
      typeof projectRow.state_json.name === "string"
        ? projectRow.state_json.name
        : projectRow.name,
  }

  const parsedProject = editorProjectSchema.safeParse(projectState)
  if (!parsedProject.success) {
    return NextResponse.json(
      { error: "Project state is invalid and cannot be rendered" },
      { status: 400 }
    )
  }

  try {
    assertCanStartRemotionRender()
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Rendering is not configured on the server",
      },
      { status: 500 }
    )
  }

  const { data: renderJob, error: insertError } = await supabase
    .from("editor_render_jobs")
    .insert({
      user_id: user.id,
      project_id: projectRow.id,
      status: "queued",
      progress: 0,
      project_snapshot: parsedProject.data,
      request_payload: {
        runner: EDITOR_RENDER_RUNNER,
        codec: "h264",
        container: "mp4",
        queued_from: "editor-app",
        engine: "@remotion/vercel",
        bundleStrategy: "local-bundle",
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

  const backgroundRender = startRemotionRenderInBackground({
    renderJobId: renderJob.id,
    project: parsedProject.data,
  })

  waitUntil(backgroundRender)

  /*
   * LEGACY RAILWAY RENDER PATH - NOT IN USE
   *
   * Kept here for fallback/reference while Vercel Sandbox is the primary
   * rendering approach.
   *
   * const workerBaseUrl = process.env.REMOTION_RENDER_WORKER_URL
   * const workerSecret = process.env.WORKER_SHARED_SECRET
   *
   * const workerResponse = await fetch(
   *   `${normalizeWorkerBaseUrl(workerBaseUrl)}/render`,
   *   {
   *     method: "POST",
   *     headers: {
   *       "Content-Type": "application/json",
   *       [EDITOR_RENDER_WORKER_SECRET_HEADER]: workerSecret,
   *     },
   *     body: JSON.stringify({ renderJobId: renderJob.id }),
   *   }
   * )
   */

  /*
   * LEGACY CUSTOM SANDBOX LAUNCHER - NOT IN USE
   *
   * The previous implementation launched a raw Vercel Sandbox, copied the
   * TypeScript source tree into it, ran npm inside the VM, and kicked off
   * a detached CLI job from the sandbox.
   *
   * Vercel Sandbox now remains the primary runtime, but the active path
   * follows Remotion's supported integration pattern instead:
   * - bundle the Remotion project in the app runtime
   * - create a sandbox through @remotion/vercel
   * - copy the prebuilt bundle into the sandbox
   * - render there and upload the result to Supabase Storage
   *
   * See: lib/video-editor/vercel-sandbox-render.ts
   */

  return NextResponse.json({ jobId: renderJob.id })
}
