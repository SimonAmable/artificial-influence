import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { normalizeTikTokVideoUrlToStorage } from "@/lib/tiktok/normalize-video"

export const TIKTOK_VIDEO_FIXER_JOB_TABLE = "tiktok_video_fixer_jobs"

function getRequiredServiceRoleClient() {
  const supabase = createServiceRoleClient()
  if (!supabase) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for TikTok video fixing"
    )
  }

  return supabase
}

async function updateTikTokVideoFixerJob(
  jobId: string,
  values: Record<string, unknown>
) {
  const supabase = getRequiredServiceRoleClient()
  const { error } = await supabase
    .from(TIKTOK_VIDEO_FIXER_JOB_TABLE)
    .update(values)
    .eq("id", jobId)

  if (error) {
    throw new Error(`Failed to update TikTok fixer job ${jobId}: ${error.message}`)
  }
}

export async function processTikTokVideoFixerJob(jobId: string) {
  const supabase = getRequiredServiceRoleClient()
  const { data: job, error } = await supabase
    .from(TIKTOK_VIDEO_FIXER_JOB_TABLE)
    .select("id, user_id, status, source_url, source_file_name")
    .eq("id", jobId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load TikTok fixer job ${jobId}: ${error.message}`)
  }

  if (!job) {
    throw new Error(`TikTok fixer job ${jobId} was not found`)
  }

  if (job.status !== "queued" && job.status !== "processing") {
    return
  }

  try {
    await updateTikTokVideoFixerJob(jobId, {
      status: "processing",
      error_message: null,
      started_at: new Date().toISOString(),
      completed_at: null,
    })

    const normalized = await normalizeTikTokVideoUrlToStorage({
      mediaUrl: String(job.source_url),
      userId: String(job.user_id),
      supabase,
      fileName:
        typeof job.source_file_name === "string" && job.source_file_name.length > 0
          ? job.source_file_name
          : "video.mp4",
    })

    await updateTikTokVideoFixerJob(jobId, {
      status: "completed",
      output_storage_path: normalized.storagePath,
      output_url: normalized.publicUrl,
      output_file_name: normalized.fileName,
      output_size_bytes: normalized.sizeBytes,
      profile: normalized.profile,
      error_message: null,
      completed_at: new Date().toISOString(),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not convert the video."

    await updateTikTokVideoFixerJob(jobId, {
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString(),
    })
  }
}
