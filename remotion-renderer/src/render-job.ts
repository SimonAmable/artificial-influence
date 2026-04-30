/*
 * LEGACY SUPABASE RENDER WORKER CORE - NOT IN USE
 *
 * Retained for fallback/reference from the previous detached worker design.
 * The active render flow now bundles locally and renders through
 * @remotion/vercel from the app runtime.
 */
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { bundle } from "@remotion/bundler"
import { renderMedia, selectComposition } from "@remotion/renderer"
import { createClient } from "@supabase/supabase-js"
import {
  COMPOSITION_ID,
  RENDER_OUTPUT_BUCKET,
  RENDER_OUTPUT_PREFIX,
} from "./constants"
import { editorProjectSchema } from "./project-types"

type RenderJobRow = {
  id: string
  user_id: string
  status: "queued" | "rendering" | "completed" | "failed"
  project_snapshot: unknown
}

const currentFile = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFile)
const remotionEntryPoint = path.join(currentDir, "remotion-entry.ts")

let serveUrlPromise: Promise<string> | null = null

function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getServeUrl(): Promise<string> {
  if (!serveUrlPromise) {
    serveUrlPromise = bundle({
      entryPoint: remotionEntryPoint,
      onProgress(progress: number) {
        if (progress % 25 === 0) {
          console.log(`[remotion-renderer] bundle progress ${progress}%`)
        }
      },
    }).catch((error: unknown) => {
      serveUrlPromise = null
      throw error
    })
  }

  return serveUrlPromise!
}

function getOutputPath(renderJobId: string): string {
  return path.join(os.tmpdir(), `${renderJobId}.mp4`)
}

function buildStoragePath(userId: string, renderJobId: string): string {
  return `${userId}/${RENDER_OUTPUT_PREFIX}/${renderJobId}.mp4`
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 1500)
  }

  return String(error).slice(0, 1500)
}

async function updateRenderJob(
  renderJobId: string,
  values: Record<string, unknown>
) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from("editor_render_jobs")
    .update(values)
    .eq("id", renderJobId)

  if (error) {
    throw new Error(`Failed to update render job: ${error.message}`)
  }
}

export async function processRenderJob(renderJobId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("editor_render_jobs")
    .select("id, user_id, status, project_snapshot")
    .eq("id", renderJobId)
    .single()

  if (error || !data) {
    throw new Error(error?.message || "Render job not found")
  }

  const job = data as RenderJobRow
  if (job.status === "rendering" || job.status === "completed") {
    return
  }

  const project = editorProjectSchema.parse(job.project_snapshot)

  await updateRenderJob(renderJobId, {
    status: "rendering",
    progress: 0,
    error_message: null,
    started_at: new Date().toISOString(),
    completed_at: null,
  })

  const outputLocation = getOutputPath(renderJobId)
  let lastReportedProgress = -1

  try {
    const serveUrl = await getServeUrl()
    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps: { project },
    })

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation,
      inputProps: { project },
      onProgress: ({ progress }: { progress: number }) => {
        const nextProgress = Math.max(1, Math.round(progress * 100))
        if (
          nextProgress === lastReportedProgress ||
          nextProgress < lastReportedProgress + 5
        ) {
          return
        }

        lastReportedProgress = nextProgress
        void updateRenderJob(renderJobId, {
          status: "rendering",
          progress: nextProgress,
        }).catch((updateError) => {
          console.error(
            `[remotion-renderer] Failed to update progress for ${renderJobId}:`,
            updateError
          )
        })
      },
    })

    const outputBytes = await fs.readFile(outputLocation)
    const storagePath = buildStoragePath(job.user_id, renderJobId)
    const uploadResult = await supabase.storage
      .from(RENDER_OUTPUT_BUCKET)
      .upload(storagePath, outputBytes, {
        contentType: "video/mp4",
        upsert: true,
      })

    if (uploadResult.error) {
      throw new Error(uploadResult.error.message)
    }

    const outputUrl = supabase.storage
      .from(RENDER_OUTPUT_BUCKET)
      .getPublicUrl(storagePath).data.publicUrl

    await updateRenderJob(renderJobId, {
      status: "completed",
      progress: 100,
      output_storage_path: storagePath,
      output_url: outputUrl,
      error_message: null,
      completed_at: new Date().toISOString(),
    })
  } catch (errorToStore) {
    await updateRenderJob(renderJobId, {
      status: "failed",
      error_message: formatErrorMessage(errorToStore),
      completed_at: new Date().toISOString(),
    })
    throw errorToStore
  } finally {
    await fs.rm(outputLocation, { force: true }).catch(() => undefined)
  }
}
