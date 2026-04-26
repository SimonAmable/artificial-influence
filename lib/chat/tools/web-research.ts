import { randomUUID } from "node:crypto"
import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  firecrawlCaptureScreenshot,
  firecrawlReadPage,
  firecrawlSearchWeb,
  firecrawlSearchWebImages,
  simpleScrapeUrl,
  type ScreenshotUploadResult,
} from "@/lib/server/web-research"

interface CreateWebResearchToolsOptions {
  supabase: SupabaseClient
  threadId?: string
  userId: string
}

function clampLimit(value: number | undefined, fallback: number, max: number) {
  return Math.min(Math.max(value ?? fallback, 1), max)
}

function getFileExtension(mimeType: string) {
  const normalized = mimeType.toLowerCase()
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg"
  if (normalized.includes("webp")) return "webp"
  return "png"
}

function getSafeUrlStem(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").replace(/[^a-z0-9-]+/gi, "-").slice(0, 48) || "page"
  } catch {
    return "page"
  }
}

async function uploadScreenshotToStorage({
  fullPage,
  screenshotUrl,
  sourceUrl,
  supabase,
  threadId,
  userId,
  viewportHeight,
  viewportWidth,
}: {
  fullPage: boolean
  screenshotUrl: string
  sourceUrl: string
  supabase: SupabaseClient
  threadId?: string
  userId: string
  viewportHeight: number
  viewportWidth: number
}): Promise<ScreenshotUploadResult> {
  const response = await fetch(screenshotUrl)

  if (!response.ok) {
    throw new Error(`Failed to download screenshot: HTTP ${response.status}.`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const bytes = Buffer.from(arrayBuffer)
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png"

  if (!mimeType.startsWith("image/")) {
    throw new Error(`Screenshot response was not an image (${mimeType}).`)
  }

  if (bytes.byteLength > 15 * 1024 * 1024) {
    throw new Error("Screenshot is too large to store. Try a smaller viewport or non-full-page capture.")
  }

  const extension = getFileExtension(mimeType)
  const storagePath = `${userId}/web-screenshots/${Date.now()}-${getSafeUrlStem(sourceUrl)}-${randomUUID().slice(0, 8)}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from("public-bucket")
    .upload(storagePath, bytes, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Failed to upload screenshot: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage.from("public-bucket").getPublicUrl(storagePath)

  if (threadId) {
    const { error: insertError } = await supabase.from("uploads").insert({
      bucket: "public-bucket",
      chat_thread_id: threadId,
      label: `Screenshot: ${getSafeUrlStem(sourceUrl).replace(/-/g, ".")}`,
      mime_type: mimeType,
      size_bytes: bytes.byteLength,
      source: "web-screenshot",
      storage_path: storagePath,
      user_id: userId,
    })

    if (insertError && insertError.code !== "23505") {
      console.error("[capturePageScreenshot] uploads insert failed:", insertError.message)
    }
  }

  return {
    fullPage,
    provider: "firecrawl",
    sourceUrl,
    storagePath,
    url: urlData.publicUrl,
    viewportHeight,
    viewportWidth,
  }
}

export function createSearchWebTool() {
  return tool({
    description:
      "Search the web for source links and snippets. Use this to find pages the user can learn from, cite, inspect, or pass to readWebPage. This does not read full page content.",
    inputSchema: z.object({
      query: z.string().min(2).max(240).describe("Search query."),
      limit: z.number().int().min(1).max(10).optional().describe("Maximum results to return. Defaults to 8."),
    }),
    strict: true,
    execute: async ({ limit, query }) => {
      const resolvedLimit = clampLimit(limit, 8, 10)
      const results = await firecrawlSearchWeb(query, resolvedLimit)

      return {
        message:
          results.length > 0
            ? `Found ${results.length} web result${results.length === 1 ? "" : "s"}.`
            : "No web results found.",
        provider: "firecrawl" as const,
        query,
        results,
        total: results.length,
      }
    },
  })
}

export function createReadWebPageTool() {
  return tool({
    description:
      "Read and extract one public web page. This first tries a cheap simple scrape, then falls back to Firecrawl when the page is blocked, JavaScript-heavy, or too weak. Handles exactly one URL per call.",
    inputSchema: z.object({
      maxChars: z
        .number()
        .int()
        .min(1_000)
        .max(40_000)
        .optional()
        .describe("Maximum extracted text/markdown characters to return. Defaults to 20000."),
      url: z.string().min(8).max(2_000).describe("Single public http(s) URL to read."),
    }),
    strict: true,
    execute: async ({ maxChars = 20_000, url }) => {
      try {
        const page = await simpleScrapeUrl(url, { maxChars })
        return {
          fallbackReason: null,
          message: `Read page with simple scrape${page.title ? `: ${page.title}` : ""}.`,
          page,
          provider: page.provider,
        }
      } catch (simpleError) {
        const fallbackReason =
          simpleError instanceof Error ? simpleError.message : "Simple scrape failed."
        const page = await firecrawlReadPage(url, { maxChars })

        return {
          fallbackReason,
          message: `Read page with Firecrawl fallback${page.title ? `: ${page.title}` : ""}.`,
          page,
          provider: page.provider,
        }
      }
    },
  })
}

export function createSearchWebImagesTool() {
  return tool({
    description:
      "Search the web for image references and inspiration. Results are web-discovered and license is not verified; do not claim they are safe for commercial reuse.",
    inputSchema: z.object({
      query: z.string().min(2).max(240).describe("Image search query."),
      limit: z.number().int().min(1).max(20).optional().describe("Maximum images to return. Defaults to 12."),
    }),
    strict: true,
    execute: async ({ limit, query }) => {
      const resolvedLimit = clampLimit(limit, 12, 20)
      const images = await firecrawlSearchWebImages(query, resolvedLimit)

      return {
        images,
        licenseNotice:
          "These images were discovered on the web and their licenses are not verified. Use them as inspiration or verify rights before reuse.",
        message:
          images.length > 0
            ? `Found ${images.length} web image reference${images.length === 1 ? "" : "s"}.`
            : "No web image references found.",
        provider: "firecrawl" as const,
        query,
        total: images.length,
      }
    },
  })
}

export function createCapturePageScreenshotTool({
  supabase,
  threadId,
  userId,
}: CreateWebResearchToolsOptions) {
  return tool({
    description:
      "Capture a screenshot of one public web page when the user explicitly asks for a screenshot, visual capture, page preview, or reference capture. Do not use automatically for every search result.",
    inputSchema: z.object({
      fullPage: z.boolean().optional().describe("Whether to capture the full scrollable page. Defaults to false; use true only when the user explicitly asks for a full-page screenshot."),
      url: z.string().min(8).max(2_000).describe("Single public http(s) URL to screenshot."),
      viewportHeight: z.number().int().min(320).max(3000).optional().describe("Viewport height. Defaults to 800."),
      viewportWidth: z.number().int().min(320).max(3000).optional().describe("Viewport width. Defaults to 1280."),
    }),
    strict: true,
    execute: async ({
      fullPage = false,
      url,
      viewportHeight = 800,
      viewportWidth = 1280,
    }) => {
      const screenshot = await firecrawlCaptureScreenshot({
        fullPage,
        url,
        viewportHeight,
        viewportWidth,
      })
      const uploaded = await uploadScreenshotToStorage({
        fullPage: screenshot.fullPage,
        screenshotUrl: screenshot.screenshotUrl,
        sourceUrl: screenshot.sourceUrl,
        supabase,
        threadId,
        userId,
        viewportHeight,
        viewportWidth,
      })

      return {
        message: threadId
          ? "Captured and saved a page screenshot to this chat."
          : "Captured and saved a page screenshot.",
        screenshot: uploaded,
      }
    },
  })
}
