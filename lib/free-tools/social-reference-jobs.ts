import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  assertLooksLikeTikTokVideoUrl,
  buildTikTokUrlDownloadActorInput,
  buildTikTokVideoSearchActorInput,
  normalizeTikTokDatasetItems,
  pickFirstPlayableDownloadUrl,
  runTikTokScraperActor,
} from "@/lib/server/apify/tiktok-scraper"
import type {
  TikTokVideoSearchDateFilter,
  TikTokVideoSearchSorting,
} from "@/lib/server/apify/tiktok-scraper-types"
import {
  buildInstagramPostActorInput,
  normalizeInstagramDatasetItem,
  runInstagramScraperActor,
} from "@/lib/server/apify/instagram-scraper"
import {
  normalizeTikTokVideoUrlToStorage,
  uploadTikTokReferenceImageRawToStorage,
  uploadTikTokReferenceVideoRawToStorage,
} from "@/lib/tiktok/normalize-video"

export const SOCIAL_REFERENCE_DOWNLOAD_JOB_TABLE = "social_reference_download_jobs" as const

/** @deprecated Use SOCIAL_REFERENCE_DOWNLOAD_JOB_TABLE — kept for external imports until full rename. */
export const TIKTOK_REFERENCE_DOWNLOAD_JOB_TABLE = SOCIAL_REFERENCE_DOWNLOAD_JOB_TABLE

export const TIKTOK_REFERENCE_SEARCH_JOB_TABLE = "tiktok_reference_search_jobs" as const
export type TikTokReferenceOutputMediaKind = "video" | "slideshow"
export type SocialReferenceSourcePlatform = "tiktok" | "instagram"

async function uploadSlideshowToStorage(input: {
  imageUrls: string[]
  userId: string
  prefix: string
  supabase: ReturnType<typeof getRequiredServiceRoleClient>
}) {
  const outputPublicUrls: string[] = []
  const outputStoragePaths: string[] = []
  let normalizationProfile: string | null = null

  for (let index = 0; index < input.imageUrls.length; index += 1) {
    const imageUrl = input.imageUrls[index]
    const uploaded = await uploadTikTokReferenceImageRawToStorage({
      mediaUrl: imageUrl,
      userId: input.userId,
      supabase: input.supabase,
      fileName: `${input.prefix}-slide-${index + 1}.jpg`,
    })
    outputPublicUrls.push(uploaded.publicUrl)
    outputStoragePaths.push(uploaded.storagePath)
    if (!normalizationProfile) {
      normalizationProfile = uploaded.profile
    }
  }

  return {
    outputPublicUrls,
    outputStoragePaths,
    normalizationProfile,
  }
}

function getRequiredServiceRoleClient() {
  const supabase = createServiceRoleClient()
  if (!supabase) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for social reference jobs",
    )
  }
  return supabase
}

async function updateDownloadJob(jobId: string, values: Record<string, unknown>) {
  const supabase = getRequiredServiceRoleClient()
  const { error } = await supabase.from(SOCIAL_REFERENCE_DOWNLOAD_JOB_TABLE).update(values).eq("id", jobId)

  if (error) {
    throw new Error(`Failed to update social reference download job ${jobId}: ${error.message}`)
  }
}

async function updateSearchJob(jobId: string, values: Record<string, unknown>) {
  const supabase = getRequiredServiceRoleClient()
  const { error } = await supabase.from(TIKTOK_REFERENCE_SEARCH_JOB_TABLE).update(values).eq("id", jobId)

  if (error) {
    throw new Error(`Failed to update TikTok reference search job ${jobId}: ${error.message}`)
  }
}

function parseStoredVideoSorting(value: unknown): TikTokVideoSearchSorting {
  const allowed: TikTokVideoSearchSorting[] = ["MOST_RELEVANT", "MOST_LIKED", "LATEST"]
  return allowed.includes(value as TikTokVideoSearchSorting) ? (value as TikTokVideoSearchSorting) : "MOST_LIKED"
}

function parseStoredDateFilter(value: unknown): TikTokVideoSearchDateFilter {
  const allowed: TikTokVideoSearchDateFilter[] = [
    "ALL_TIME",
    "PAST_24_HOURS",
    "PAST_WEEK",
    "PAST_MONTH",
    "LAST_3_MONTHS",
    "LAST_6_MONTHS",
  ]
  return allowed.includes(value as TikTokVideoSearchDateFilter)
    ? (value as TikTokVideoSearchDateFilter)
    : "ALL_TIME"
}

function resolveSourcePlatform(raw: unknown): SocialReferenceSourcePlatform {
  return raw === "instagram" ? "instagram" : "tiktok"
}

async function finalizeDownloadSuccess(
  jobId: string,
  values: Record<string, unknown>,
) {
  await updateDownloadJob(jobId, {
    ...values,
    status: "completed",
    error_message: null,
    completed_at: new Date().toISOString(),
  })
}

async function finalizeDownloadFailure(jobId: string, message: string) {
  await updateDownloadJob(jobId, {
    status: "failed",
    error_message: message,
    completed_at: new Date().toISOString(),
  })
}

async function executeTiktokDownload(jobId: string, job: { user_id: string; source_tiktok_url: string }) {
  const supabase = getRequiredServiceRoleClient()
  const sourceUrl = String(job.source_tiktok_url)
  assertLooksLikeTikTokVideoUrl(sourceUrl)

  const { runId, items } = await runTikTokScraperActor(buildTikTokUrlDownloadActorInput(sourceUrl), 300)
  const normalizedList = normalizeTikTokDatasetItems(items)
  const first = normalizedList[0]
  if (!first) {
    throw new Error("Apify returned no TikTok rows for this URL.")
  }

  let outputPublicUrl: string | null = null
  let outputStoragePath: string | null = null
  let outputPublicUrls: string[] = []
  let outputStoragePaths: string[] = []
  let outputMediaKind: TikTokReferenceOutputMediaKind | null = null
  let normalizationProfile: string | null = null
  const playable = pickFirstPlayableDownloadUrl(first)

  if (playable) {
    outputMediaKind = "video"
    try {
      const normalized = await normalizeTikTokVideoUrlToStorage({
        mediaUrl: playable,
        userId: String(job.user_id),
        supabase,
        fileName: "tiktok-reference.mp4",
      })
      outputPublicUrl = normalized.publicUrl
      outputStoragePath = normalized.storagePath
      outputPublicUrls = [normalized.publicUrl]
      outputStoragePaths = [normalized.storagePath]
      normalizationProfile = normalized.profile
    } catch (normalizeError) {
      try {
        const uploaded = await uploadTikTokReferenceVideoRawToStorage({
          mediaUrl: playable,
          userId: String(job.user_id),
          supabase,
          fileName: "tiktok-reference.mp4",
        })
        outputPublicUrl = uploaded.publicUrl
        outputStoragePath = uploaded.storagePath
        outputPublicUrls = [uploaded.publicUrl]
        outputStoragePaths = [uploaded.storagePath]
        normalizationProfile = uploaded.profile
      } catch (rawError) {
        const hasSlideshowFallback = first.slideshowImageUrls.length > 0
        if (hasSlideshowFallback) {
          const slideshowSaved = await uploadSlideshowToStorage({
            imageUrls: first.slideshowImageUrls,
            userId: String(job.user_id),
            prefix: "tiktok",
            supabase,
          })
          outputMediaKind = "slideshow"
          outputPublicUrls = slideshowSaved.outputPublicUrls
          outputStoragePaths = slideshowSaved.outputStoragePaths
          normalizationProfile = slideshowSaved.normalizationProfile
          outputPublicUrl = outputPublicUrls[0] ?? null
          outputStoragePath = outputStoragePaths[0] ?? null
        } else {
          const normalizeMsg =
            normalizeError instanceof Error ? normalizeError.message : String(normalizeError)
          const rawMsg = rawError instanceof Error ? rawError.message : String(rawError)
          throw new Error(
            `Could not save the TikTok clip to Storage. Transcode failed (${normalizeMsg}); raw upload failed (${rawMsg}).`,
          )
        }
      }
    }
  } else if (first.slideshowImageUrls.length > 0) {
    outputMediaKind = "slideshow"
    const slideshowSaved = await uploadSlideshowToStorage({
      imageUrls: first.slideshowImageUrls,
      userId: String(job.user_id),
      prefix: "tiktok",
      supabase,
    })
    outputPublicUrls = slideshowSaved.outputPublicUrls
    outputStoragePaths = slideshowSaved.outputStoragePaths
    normalizationProfile = slideshowSaved.normalizationProfile
    outputPublicUrl = outputPublicUrls[0] ?? null
    outputStoragePath = outputStoragePaths[0] ?? null
    if (!outputPublicUrl) {
      throw new Error("Slideshow media was detected but no images were saved to Storage.")
    }
  } else {
    throw new Error(
      "TikTok did not return downloadable video or slideshow media for this post (gated content or empty stream metadata). Another clip usually works.",
    )
  }

  const snapshot =
    outputMediaKind === "video" && outputPublicUrl != null
      ? { ...first, playableVideoUrl: outputPublicUrl }
      : first

  await finalizeDownloadSuccess(jobId, {
    apify_run_id: runId,
    tiktok_snapshot: snapshot,
    output_public_url: outputPublicUrl,
    output_storage_path: outputStoragePath,
    output_public_urls: outputPublicUrls,
    output_storage_paths: outputStoragePaths,
    output_media_kind: outputMediaKind,
    normalization_profile: normalizationProfile,
  })
}

async function executeInstagramDownload(jobId: string, job: { user_id: string; source_tiktok_url: string }) {
  const supabase = getRequiredServiceRoleClient()
  const sourceUrl = String(job.source_tiktok_url)

  const { runId, items } = await runInstagramScraperActor(buildInstagramPostActorInput(sourceUrl), 300)

  let normalized: ReturnType<typeof normalizeInstagramDatasetItem> = null
  for (const row of items) {
    normalized = normalizeInstagramDatasetItem(row)
    if (normalized) break
  }

  if (!normalized) {
    throw new Error("Apify returned no Instagram rows for this URL.")
  }

  const fallbackImages =
    normalized.mediaUrls.length > 0
      ? normalized.mediaUrls
      : normalized.displayUrl
        ? [normalized.displayUrl]
        : []

  let outputPublicUrl: string | null = null
  let outputStoragePath: string | null = null
  let outputPublicUrls: string[] = []
  let outputStoragePaths: string[] = []
  let outputMediaKind: TikTokReferenceOutputMediaKind | null = null
  let normalizationProfile: string | null = null

  if (normalized.videoUrl) {
    outputMediaKind = "video"
    try {
      const transcoded = await normalizeTikTokVideoUrlToStorage({
        mediaUrl: normalized.videoUrl,
        userId: String(job.user_id),
        supabase,
        fileName: "instagram-reference.mp4",
      })
      outputPublicUrl = transcoded.publicUrl
      outputStoragePath = transcoded.storagePath
      outputPublicUrls = [transcoded.publicUrl]
      outputStoragePaths = [transcoded.storagePath]
      normalizationProfile = transcoded.profile
    } catch (normalizeError) {
      try {
        const uploaded = await uploadTikTokReferenceVideoRawToStorage({
          mediaUrl: normalized.videoUrl,
          userId: String(job.user_id),
          supabase,
          fileName: "instagram-reference.mp4",
        })
        outputPublicUrl = uploaded.publicUrl
        outputStoragePath = uploaded.storagePath
        outputPublicUrls = [uploaded.publicUrl]
        outputStoragePaths = [uploaded.storagePath]
        normalizationProfile = uploaded.profile
      } catch (rawError) {
        if (fallbackImages.length === 0) {
          const normalizeMsg =
            normalizeError instanceof Error ? normalizeError.message : String(normalizeError)
          const rawMsg = rawError instanceof Error ? rawError.message : String(rawError)
          throw new Error(
            `Could not save Instagram video to Storage. Transcode (${normalizeMsg}); raw (${rawMsg}).`,
          )
        }
        outputMediaKind = "slideshow"
        const slideshowSaved = await uploadSlideshowToStorage({
          imageUrls: fallbackImages,
          userId: String(job.user_id),
          prefix: "instagram",
          supabase,
        })
        outputPublicUrls = slideshowSaved.outputPublicUrls
        outputStoragePaths = slideshowSaved.outputStoragePaths
        normalizationProfile = slideshowSaved.normalizationProfile
        outputPublicUrl = outputPublicUrls[0] ?? null
        outputStoragePath = outputStoragePaths[0] ?? null
      }
    }
  } else if (fallbackImages.length > 0) {
    outputMediaKind = "slideshow"
    const slideshowSaved = await uploadSlideshowToStorage({
      imageUrls: fallbackImages,
      userId: String(job.user_id),
      prefix: "instagram",
      supabase,
    })
    outputPublicUrls = slideshowSaved.outputPublicUrls
    outputStoragePaths = slideshowSaved.outputStoragePaths
    normalizationProfile = slideshowSaved.normalizationProfile
    outputPublicUrl = outputPublicUrls[0] ?? null
    outputStoragePath = outputStoragePaths[0] ?? null
    if (!outputPublicUrl) {
      throw new Error("Instagram images were detected but nothing was saved to Storage.")
    }
  } else {
    throw new Error(
      "Instagram did not return downloadable video or images for this post (private/restricted or empty CDN metadata).",
    )
  }

  const snapshot =
    outputMediaKind === "video" && outputPublicUrl != null
      ? {
          ...normalized,
          hostedPrimaryUrl: outputPublicUrl,
          videoUrl: outputPublicUrl,
        }
      : normalized

  await finalizeDownloadSuccess(jobId, {
    apify_run_id: runId,
    tiktok_snapshot: snapshot,
    output_public_url: outputPublicUrl,
    output_storage_path: outputStoragePath,
    output_public_urls: outputPublicUrls,
    output_storage_paths: outputStoragePaths,
    output_media_kind: outputMediaKind,
    normalization_profile: normalizationProfile,
  })
}

export async function processSocialReferenceDownloadJob(jobId: string) {
  const supabase = getRequiredServiceRoleClient()
  const { data: job, error } = await supabase
    .from(SOCIAL_REFERENCE_DOWNLOAD_JOB_TABLE)
    .select("id, user_id, status, source_tiktok_url, source_platform")
    .eq("id", jobId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load social reference download job ${jobId}: ${error.message}`)
  }

  if (!job) {
    throw new Error(`Social reference download job ${jobId} was not found`)
  }

  const statusValue = typeof job.status === "string" ? job.status : ""
  if (statusValue !== "queued" && statusValue !== "processing") {
    return
  }

  try {
    await updateDownloadJob(jobId, {
      status: "processing",
      error_message: null,
      started_at: new Date().toISOString(),
      completed_at: null,
    })

    const typedJob = job as {
      id: string
      user_id: string
      status: string | null
      source_tiktok_url: string
      source_platform?: string | null
    }

    const platform = resolveSourcePlatform(typedJob.source_platform)

    if (platform === "instagram") {
      await executeInstagramDownload(jobId, {
        user_id: String(typedJob.user_id),
        source_tiktok_url: String(typedJob.source_tiktok_url),
      })
    } else {
      await executeTiktokDownload(jobId, {
        user_id: String(typedJob.user_id),
        source_tiktok_url: String(typedJob.source_tiktok_url),
      })
    }
  } catch (processingError) {
    const message =
      processingError instanceof Error
        ? processingError.message
        : "Reference download failed unexpectedly."

    await finalizeDownloadFailure(jobId, message)
  }
}

/** @deprecated Use processSocialReferenceDownloadJob */
export async function processTikTokReferenceDownloadJob(jobId: string) {
  return processSocialReferenceDownloadJob(jobId)
}

export async function processTikTokReferenceSearchJob(jobId: string) {
  const supabase = getRequiredServiceRoleClient()
  const { data: job, error } = await supabase
    .from(TIKTOK_REFERENCE_SEARCH_JOB_TABLE)
    .select("id, user_id, status, search_query, video_sorting, date_filter, results_requested")
    .eq("id", jobId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load TikTok reference search job ${jobId}: ${error.message}`)
  }

  if (!job) {
    throw new Error(`TikTok reference search job ${jobId} was not found`)
  }

  const statusValue = typeof job.status === "string" ? job.status : ""
  if (statusValue !== "queued" && statusValue !== "processing") {
    return
  }

  try {
    await updateSearchJob(jobId, {
      status: "processing",
      error_message: null,
      started_at: new Date().toISOString(),
      completed_at: null,
    })

    const queryText = String(job.search_query).trim()
    if (!queryText) {
      throw new Error("Search query is empty.")
    }

    const sorting = parseStoredVideoSorting(job.video_sorting)
    const dateFilter = parseStoredDateFilter(job.date_filter)
    const requested = Math.min(Number(job.results_requested), 50)
    const resultsCap = Number.isFinite(requested) && requested > 0 ? requested : 24

    const payload = buildTikTokVideoSearchActorInput({
      query: queryText,
      resultsPerPage: resultsCap,
      videoSearchSorting: sorting,
      videoSearchDateFilter: dateFilter,
    })

    const { runId, items } = await runTikTokScraperActor(payload, 300)
    const videos = normalizeTikTokDatasetItems(items)

    await updateSearchJob(jobId, {
      status: "completed",
      apify_run_id: runId,
      result_videos: videos,
      error_message: null,
      completed_at: new Date().toISOString(),
    })
  } catch (processingError) {
    const message =
      processingError instanceof Error ? processingError.message : "TikTok search failed unexpectedly."

    await updateSearchJob(jobId, {
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString(),
    })
  }
}
