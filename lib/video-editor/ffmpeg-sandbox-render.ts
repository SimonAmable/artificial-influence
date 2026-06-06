import { Sandbox } from "@vercel/sandbox"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { buildFfmpegAssProject } from "@/lib/video-editor/ffmpeg-ass"
import {
  buildEditorRenderStoragePath,
  EDITOR_RENDER_OUTPUT_BUCKET,
  truncateRenderErrorMessage,
} from "@/lib/video-editor/render-jobs"
import type { EditorProject } from "@/lib/video-editor/types"

const SANDBOX_ASS_PATH = "/vercel/sandbox/overlay.ass"
const SANDBOX_INPUT_PATH = "/vercel/sandbox/source-video"
const SANDBOX_OUTPUT_PATH = "/vercel/sandbox/rendered-overlay.mp4"
const SANDBOX_FFMPEG_PATH = "/usr/local/bin/ffmpeg"

type StartFfmpegRenderJobParams = {
  project: EditorProject
  renderJobId: string
}

function getRequiredServiceRoleClient() {
  const supabase = createServiceRoleClient()
  if (!supabase) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for rendering"
    )
  }
  return supabase
}

function getRequiredSnapshotId() {
  const snapshotId = process.env.VERCEL_FFMPEG_SANDBOX_SNAPSHOT_ID
  if (!snapshotId) {
    throw new Error("VERCEL_FFMPEG_SANDBOX_SNAPSHOT_ID is required for FFmpeg rendering")
  }
  return snapshotId
}

function getSandboxTimeoutMs() {
  const raw = Number(process.env.VERCEL_SANDBOX_RENDER_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : 15 * 60 * 1000
}

function getSandboxVcpus() {
  const raw = Number(process.env.VERCEL_SANDBOX_RENDER_VCPUS)
  return Number.isFinite(raw) && raw > 0 ? raw : 4
}

async function updateRenderJob(renderJobId: string, values: Record<string, unknown>) {
  const supabase = getRequiredServiceRoleClient()
  const { error } = await supabase.from("editor_render_jobs").update(values).eq("id", renderJobId)
  if (error) {
    throw new Error(`Failed to update render job ${renderJobId}: ${error.message}`)
  }
}

async function runSandboxCommand(
  sandbox: Sandbox,
  command: string,
  args: string[],
  label: string
) {
  const result = await sandbox.runCommand({ cmd: command, args })
  if (result.exitCode === 0) {
    return
  }

  const stderr = await result.stderr().catch(() => "")
  throw new Error(`${label} failed${stderr ? `: ${stderr.slice(-1200)}` : ""}`)
}

async function runFfmpegRenderJob({ project, renderJobId }: StartFfmpegRenderJobParams) {
  const supabase = getRequiredServiceRoleClient()
  const snapshotId = getRequiredSnapshotId()
  const { ass, sourceVideo, textItems } = buildFfmpegAssProject(project)
  const { data: job, error: jobError } = await supabase
    .from("editor_render_jobs")
    .select("id, user_id")
    .eq("id", renderJobId)
    .single()

  if (jobError || !job) {
    throw new Error(jobError?.message ?? "Render job not found")
  }

  let sandbox: Sandbox | null = null
  try {
    await updateRenderJob(renderJobId, {
      status: "rendering",
      progress: 5,
      error_message: null,
      started_at: new Date().toISOString(),
      completed_at: null,
      request_payload: {
        runner: "vercel-sandbox",
        engine: "ffmpeg-ass",
        codec: "h264",
        container: "mp4",
        textItemCount: textItems.length,
        snapshotId,
      },
    })

    sandbox = await Sandbox.create({
      source: { type: "snapshot", snapshotId },
      timeout: getSandboxTimeoutMs(),
      resources: { vcpus: getSandboxVcpus() },
    })

    await updateRenderJob(renderJobId, { progress: 15 })
    await sandbox.writeFiles([{ path: SANDBOX_ASS_PATH, content: ass }])

    await runSandboxCommand(
      sandbox,
      "curl",
      ["-L", "--fail", "--silent", "--show-error", "--output", SANDBOX_INPUT_PATH, sourceVideo.src],
      "Source video download"
    )

    await updateRenderJob(renderJobId, { progress: 30 })
    await runSandboxCommand(
      sandbox,
      SANDBOX_FFMPEG_PATH,
      [
        "-y",
        "-i",
        SANDBOX_INPUT_PATH,
        "-vf",
        `ass=${SANDBOX_ASS_PATH}:fontsdir=/usr/share/fonts`,
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        SANDBOX_OUTPUT_PATH,
      ],
      "FFmpeg text overlay render"
    )

    await updateRenderJob(renderJobId, { progress: 92 })
    const outputBuffer = await sandbox.readFileToBuffer({ path: SANDBOX_OUTPUT_PATH })
    if (!outputBuffer) {
      throw new Error("FFmpeg completed without producing an output video")
    }

    const storagePath = buildEditorRenderStoragePath(job.user_id, renderJobId)
    const upload = await supabase.storage
      .from(EDITOR_RENDER_OUTPUT_BUCKET)
      .upload(storagePath, outputBuffer, {
        contentType: "video/mp4",
        upsert: true,
      })
    if (upload.error) {
      throw new Error(upload.error.message)
    }

    const outputUrl = supabase.storage
      .from(EDITOR_RENDER_OUTPUT_BUCKET)
      .getPublicUrl(storagePath).data.publicUrl

    await updateRenderJob(renderJobId, {
      status: "completed",
      progress: 100,
      output_storage_path: storagePath,
      output_url: outputUrl,
      error_message: null,
      completed_at: new Date().toISOString(),
    })
  } catch (error) {
    await updateRenderJob(renderJobId, {
      status: "failed",
      error_message: truncateRenderErrorMessage(
        error instanceof Error ? error.message : String(error)
      ),
      completed_at: new Date().toISOString(),
    }).catch((updateError) => {
      console.error(`[ffmpeg-overlay] Failed to store failure for ${renderJobId}:`, updateError)
    })
    throw error
  } finally {
    await sandbox?.stop({ blocking: false }).catch((stopError) => {
      console.error(`[ffmpeg-overlay] Failed to stop sandbox for ${renderJobId}:`, stopError)
    })
  }
}

export function assertCanStartFfmpegOverlayRender() {
  getRequiredServiceRoleClient()
  getRequiredSnapshotId()
}

export function startFfmpegOverlayRenderInBackground(
  params: StartFfmpegRenderJobParams
): Promise<void> {
  return runFfmpegRenderJob(params).catch((error) => {
    console.error(`[ffmpeg-overlay] Background render failed for ${params.renderJobId}:`, error)
    throw error
  })
}
