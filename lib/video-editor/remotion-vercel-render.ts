import { promises as fs } from "node:fs"
import path from "node:path"
import { bundle } from "@remotion/bundler"
import {
  addBundleToSandbox,
  createSandbox,
  renderMediaOnVercel,
} from "@remotion/vercel"
import type { RenderMediaOnVercelProgress, VercelSandbox } from "@remotion/vercel"
import { Sandbox } from "@vercel/sandbox"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  buildEditorRenderStoragePath,
  EDITOR_RENDER_OUTPUT_BUCKET,
  EDITOR_RENDER_RUNNER,
  truncateRenderErrorMessage,
} from "@/lib/video-editor/render-jobs"
import type { EditorProject } from "@/lib/video-editor/types"

const REMOTION_ENTRY_POINT = path.join(
  process.cwd(),
  "remotion-renderer",
  "src",
  "remotion-entry.ts"
)

const REMOTION_COMPOSITION_ID = "TimelineComposition"

type StartRenderJobParams = {
  renderJobId: string
  project: EditorProject
}

type RenderRequestPayload = {
  runner: string
  codec: "h264"
  container: "mp4"
  queued_from: "editor-app"
  engine: "@remotion/vercel"
  bundleStrategy: "local-bundle"
  sandboxId?: string | null
  sandboxSnapshotId?: string | null
}

function createRenderPayload(
  overrides: Partial<RenderRequestPayload> = {}
): RenderRequestPayload {
  return {
    runner: EDITOR_RENDER_RUNNER,
    codec: "h264",
    container: "mp4",
    queued_from: "editor-app",
    engine: "@remotion/vercel",
    bundleStrategy: "local-bundle",
    ...overrides,
  }
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

function getSandboxTimeoutMs(): number {
  const raw = process.env.VERCEL_SANDBOX_RENDER_TIMEOUT_MS
  if (!raw) {
    return 45 * 60 * 1000
  }

  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 45 * 60 * 1000
}

function getSandboxVcpus(): number {
  const raw = process.env.VERCEL_SANDBOX_RENDER_VCPUS
  if (!raw) {
    return 4
  }

  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4
}

function getLicenseKey(): string | null {
  return process.env.REMOTION_LICENSE_KEY ?? null
}

async function updateRenderJob(
  renderJobId: string,
  values: Record<string, unknown>
): Promise<void> {
  const supabase = getRequiredServiceRoleClient()
  const { error } = await supabase
    .from("editor_render_jobs")
    .update(values)
    .eq("id", renderJobId)

  if (error) {
    throw new Error(`Failed to update render job ${renderJobId}: ${error.message}`)
  }
}

async function updateRenderJobWhileRendering(
  renderJobId: string,
  values: Record<string, unknown>
): Promise<boolean> {
  const supabase = getRequiredServiceRoleClient()
  const { error, count } = await supabase
    .from("editor_render_jobs")
    .update(values, { count: "exact" })
    .eq("id", renderJobId)
    .eq("status", "rendering")

  if (error) {
    throw new Error(`Failed to update render job ${renderJobId}: ${error.message}`)
  }

  return (count ?? 0) > 0
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(100, Math.round(progress)))
}

function mapSandboxProgress(progress: number): number {
  return clampProgress(10 + progress * 15)
}

function mapRenderProgress(progress: RenderMediaOnVercelProgress): number {
  switch (progress.stage) {
    case "opening-browser":
      return clampProgress(35 + progress.overallProgress * 5)
    case "selecting-composition":
      return clampProgress(45 + progress.overallProgress * 10)
    case "render-progress":
      return clampProgress(55 + progress.overallProgress * 40)
    default:
      return 55
  }
}

async function createBundleDir(renderJobId: string): Promise<string> {
  const tempRoot = path.join(process.cwd(), ".tmp")
  await fs.mkdir(tempRoot, { recursive: true })
  const prefix = path.join(tempRoot, `editor-render-${renderJobId}-`)
  return fs.mkdtemp(prefix)
}

async function createRendererBundle(
  renderJobId: string,
  bundleDir: string
): Promise<void> {
  await updateRenderJob(renderJobId, {
    status: "rendering",
    progress: 5,
    error_message: null,
    started_at: new Date().toISOString(),
    completed_at: null,
  })

  await bundle({
    entryPoint: REMOTION_ENTRY_POINT,
    outDir: bundleDir,
    onProgress: (progress) => {
      void updateRenderJobWhileRendering(renderJobId, {
        status: "rendering",
        progress: clampProgress(5 + progress * 0.2),
      }).catch((error) => {
        console.error(
          `[editor-render] Failed to update bundle progress for ${renderJobId}:`,
          error
        )
      })
    },
  })
}

async function createRenderSandbox(
  renderJobId: string
): Promise<{ sandbox: VercelSandbox; snapshotId: string | null }> {
  const snapshotId = process.env.VERCEL_SANDBOX_RENDER_SNAPSHOT_ID ?? null

  if (snapshotId) {
    await updateRenderJob(renderJobId, {
      status: "rendering",
      progress: 20,
    })

    const sandbox = (await Sandbox.create({
      source: {
        type: "snapshot",
        snapshotId,
      },
      timeout: getSandboxTimeoutMs(),
      resources: { vcpus: getSandboxVcpus() },
    })) as VercelSandbox

    return { sandbox, snapshotId }
  }

  const sandbox = await createSandbox({
    timeoutInMilliseconds: getSandboxTimeoutMs(),
    resources: { vcpus: getSandboxVcpus() },
    onProgress: (update) => {
      void updateRenderJobWhileRendering(renderJobId, {
        status: "rendering",
        progress: mapSandboxProgress(update.progress),
      }).catch((error) => {
        console.error(
          `[editor-render] Failed to update sandbox progress for ${renderJobId}:`,
          error
        )
      })
    },
  })

  return { sandbox, snapshotId: null }
}

async function uploadRenderedVideo(params: {
  renderJobId: string
  userId: string
  sandbox: VercelSandbox
  sandboxFilePath: string
}): Promise<{ storagePath: string; outputUrl: string }> {
  const { renderJobId, userId, sandbox, sandboxFilePath } = params
  const supabase = getRequiredServiceRoleClient()

  await updateRenderJob(renderJobId, {
    status: "rendering",
    progress: 97,
  })

  const videoBuffer = await sandbox.readFileToBuffer({ path: sandboxFilePath })
  if (!videoBuffer) {
    throw new Error("Rendered video file was not found in the sandbox")
  }

  const storagePath = buildEditorRenderStoragePath(userId, renderJobId)
  const uploadResult = await supabase.storage
    .from(EDITOR_RENDER_OUTPUT_BUCKET)
    .upload(storagePath, videoBuffer, {
      contentType: "video/mp4",
      upsert: true,
    })

  if (uploadResult.error) {
    throw new Error(uploadResult.error.message)
  }

  const outputUrl = supabase.storage
    .from(EDITOR_RENDER_OUTPUT_BUCKET)
    .getPublicUrl(storagePath).data.publicUrl

  return { storagePath, outputUrl }
}

async function runRenderJob({
  renderJobId,
  project,
}: StartRenderJobParams): Promise<void> {
  const supabase = getRequiredServiceRoleClient()
  const { data: job, error: jobError } = await supabase
    .from("editor_render_jobs")
    .select("id, user_id")
    .eq("id", renderJobId)
    .single()

  if (jobError || !job) {
    throw new Error(jobError?.message ?? "Render job not found")
  }

  let bundleDir: string | null = null
  let sandbox: VercelSandbox | null = null
  let snapshotId: string | null = null

  try {
    bundleDir = await createBundleDir(renderJobId)
    await createRendererBundle(renderJobId, bundleDir)

    const sandboxState = await createRenderSandbox(renderJobId)
    sandbox = sandboxState.sandbox
    snapshotId = sandboxState.snapshotId

    await updateRenderJob(renderJobId, {
      status: "rendering",
      progress: 25,
      request_payload: createRenderPayload({
        sandboxId: sandbox.sandboxId,
        sandboxSnapshotId: snapshotId,
      }),
    })

    await addBundleToSandbox({
      sandbox,
      bundleDir: path.relative(process.cwd(), bundleDir),
    })

    await updateRenderJob(renderJobId, {
      status: "rendering",
      progress: 30,
    })

    const { sandboxFilePath } = await renderMediaOnVercel({
      sandbox,
      compositionId: REMOTION_COMPOSITION_ID,
      inputProps: { project },
      codec: "h264",
      licenseKey: getLicenseKey(),
      onProgress: (progress) => {
        void updateRenderJobWhileRendering(renderJobId, {
          status: "rendering",
          progress: mapRenderProgress(progress),
        }).catch((error) => {
          console.error(
            `[editor-render] Failed to update render progress for ${renderJobId}:`,
            error
          )
        })
      },
    })

    const { storagePath, outputUrl } = await uploadRenderedVideo({
      renderJobId,
      userId: job.user_id,
      sandbox,
      sandboxFilePath,
    })

    await updateRenderJob(renderJobId, {
      status: "completed",
      progress: 100,
      output_storage_path: storagePath,
      output_url: outputUrl,
      error_message: null,
      completed_at: new Date().toISOString(),
      request_payload: createRenderPayload({
        sandboxId: sandbox.sandboxId,
        sandboxSnapshotId: snapshotId,
      }),
    })
  } catch (error) {
    await updateRenderJob(renderJobId, {
      status: "failed",
      error_message: truncateRenderErrorMessage(
        error instanceof Error ? error.message : String(error)
      ),
      completed_at: new Date().toISOString(),
      request_payload: createRenderPayload({
        sandboxId: sandbox?.sandboxId ?? null,
        sandboxSnapshotId: snapshotId,
      }),
    }).catch((updateError) => {
      console.error(
        `[editor-render] Failed to store render failure for ${renderJobId}:`,
        updateError
      )
    })

    throw error
  } finally {
    await Promise.all([
      sandbox?.stop({ blocking: false }).catch((stopError) => {
        console.error(
          `[editor-render] Failed to stop sandbox for ${renderJobId}:`,
          stopError
        )
      }),
      bundleDir
        ? fs.rm(bundleDir, { recursive: true, force: true }).catch((cleanupError) => {
            console.error(
              `[editor-render] Failed to clean up bundle dir for ${renderJobId}:`,
              cleanupError
            )
          })
        : Promise.resolve(),
    ])
  }
}

export function assertCanStartRemotionRender(): void {
  getRequiredServiceRoleClient()
}

export function startRemotionRenderInBackground(
  params: StartRenderJobParams
): Promise<void> {
  return runRenderJob(params).catch((error) => {
    console.error(`[editor-render] Background render failed for ${params.renderJobId}:`, error)
    throw error
  })
}
