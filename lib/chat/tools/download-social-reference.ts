import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import {
  processSocialReferenceDownloadJob,
  SOCIAL_REFERENCE_DOWNLOAD_JOB_TABLE,
} from "@/lib/free-tools/social-reference-jobs"
import { detectSocialPlatform } from "@/lib/server/apify/instagram-scraper"

interface CreateDownloadSocialReferenceToolOptions {
  supabase: SupabaseClient
  userId: string
}

export function createDownloadSocialReferenceTool({
  supabase,
  userId,
}: CreateDownloadSocialReferenceToolOptions) {
  return tool({
    description:
      "Download a TikTok or Instagram post video or slideshow reference from a URL. Saves media to UniCan Storage and returns public URLs plus metadata.",
    inputSchema: z.object({
      url: z
        .string()
        .min(1)
        .describe("Full TikTok or Instagram post/share URL."),
    }),
    strict: true,
    execute: async ({ url }) => {
      const trimmed = url.trim()
      let sourcePlatform: "tiktok" | "instagram"
      try {
        sourcePlatform = detectSocialPlatform(trimmed)
      } catch (validationError) {
        const message =
          validationError instanceof Error ? validationError.message : "Invalid URL."
        throw new Error(message)
      }

      const { data: job, error: insertError } = await supabase
        .from(SOCIAL_REFERENCE_DOWNLOAD_JOB_TABLE)
        .insert({
          user_id: userId,
          status: "queued",
          source_tiktok_url: trimmed,
          source_platform: sourcePlatform,
        })
        .select("id")
        .single()

      if (insertError || !job) {
        throw new Error(insertError?.message ?? "Could not create download job.")
      }

      const jobId = String(job.id)
      await processSocialReferenceDownloadJob(jobId)

      const { data: row, error: fetchError } = await supabase
        .from(SOCIAL_REFERENCE_DOWNLOAD_JOB_TABLE)
        .select(
          "status, output_public_url, output_storage_path, output_public_urls, output_storage_paths, output_media_kind, error_message",
        )
        .eq("id", jobId)
        .eq("user_id", userId)
        .maybeSingle()

      if (fetchError) {
        throw new Error(fetchError.message)
      }

      const status =
        typeof row?.status === "string" ? row.status : ""

      if (status === "failed") {
        const err =
          typeof row?.error_message === "string" && row.error_message.length > 0
            ? row.error_message
            : "Social reference download failed."
        throw new Error(err)
      }

      if (status !== "completed") {
        throw new Error(`Download job ended in unexpected status: ${status || "unknown"}.`)
      }

      const outputPublicUrls = Array.isArray(row?.output_public_urls)
        ? row.output_public_urls.filter((x): x is string => typeof x === "string")
        : []

      const outputStoragePaths = Array.isArray(row?.output_storage_paths)
        ? row.output_storage_paths.filter((x): x is string => typeof x === "string")
        : []

      const outputPublicUrl =
        typeof row?.output_public_url === "string" ? row.output_public_url : null
      const outputStoragePath =
        typeof row?.output_storage_path === "string" ? row.output_storage_path : null
      const outputMediaKind =
        row?.output_media_kind === "video" || row?.output_media_kind === "slideshow"
          ? row.output_media_kind
          : null

      return {
        message:
          outputMediaKind === "slideshow"
            ? `Downloaded ${outputPublicUrls.length} slideshow image${outputPublicUrls.length === 1 ? "" : "s"}.`
            : outputPublicUrl
              ? "Download completed; primary media URL returned."
              : "Download marked completed.",
        jobId,
        sourcePlatform,
        outputPublicUrl,
        outputPublicUrls,
        outputMediaKind,
        outputStoragePath,
        outputStoragePaths,
      }
    },
  })
}
