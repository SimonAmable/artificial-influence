import { z } from "zod"

export const EDITOR_RENDER_OUTPUT_BUCKET = "public-bucket"
export const EDITOR_RENDER_OUTPUT_PREFIX = "editor-renders"
export const EDITOR_RENDER_RUNNER = "vercel-sandbox"

/*
 * LEGACY RAILWAY WORKER CONSTANTS - NOT IN USE
 *
 * Kept for fallback/reference while Vercel Sandbox is the main render path.
 */
export const EDITOR_RENDER_WORKER_SECRET_HEADER = "x-worker-shared-secret"
export const EDITOR_RENDER_COMPOSITION_ID = "TimelineComposition"

export const editorRenderJobStatusSchema = z.enum([
  "queued",
  "rendering",
  "completed",
  "failed",
])

export type EditorRenderJobStatus = z.infer<typeof editorRenderJobStatusSchema>

export const editorRenderJobApiResponseSchema = z.object({
  id: z.string(),
  status: editorRenderJobStatusSchema,
  progress: z.number().nullable().optional(),
  outputUrl: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
})

export type EditorRenderJobApiResponse = z.infer<
  typeof editorRenderJobApiResponseSchema
>

export type EditorRenderJobRow = {
  id: string
  status: EditorRenderJobStatus
  progress: number | null
  output_url: string | null
  error_message: string | null
}

export function mapEditorRenderJobRowToResponse(
  row: EditorRenderJobRow
): EditorRenderJobApiResponse {
  return {
    id: row.id,
    status: row.status,
    progress: row.progress,
    outputUrl: row.output_url,
    errorMessage: row.error_message,
  }
}

export function buildEditorRenderStoragePath(
  userId: string,
  renderJobId: string
): string {
  return `${userId}/${EDITOR_RENDER_OUTPUT_PREFIX}/${renderJobId}.mp4`
}

export function normalizeWorkerBaseUrl(url: string): string {
  return url.replace(/\/+$/, "")
}

export function truncateRenderErrorMessage(
  message: string,
  maxLength = 1500
): string {
  return message.length > maxLength
    ? `${message.slice(0, maxLength - 3)}...`
    : message
}
