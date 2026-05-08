import { NextResponse } from "next/server"

import { AI_GATEWAY_CONFIG_ERROR, hasAIGatewayCredentials } from "@/lib/ai/gateway"
import { createClient } from "@/lib/supabase/server"
import { extractPageForBrand } from "@/lib/brand-kit/analyze-html"
import { buildFallbackBrandDraft, draftBrandFromPage } from "@/lib/brand-kit/analyze-url-llm"
import { maybeFetchReaderMarkdown } from "@/lib/brand-kit/analyze-url-phase2"
import type { BrandOnboardingObject } from "@/lib/brand-kit/onboarding-schema"
import { normalizeHttpUrl, fetchUrlSafe } from "@/lib/brand-kit/url-safety"

export async function POST(request: Request) {
  try {
    if (!hasAIGatewayCredentials()) {
      return NextResponse.json(
        { error: AI_GATEWAY_CONFIG_ERROR },
        { status: 500 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const requestBody = (await request.json().catch(() => ({}))) as { url?: string }
    const rawUrl = typeof requestBody.url === "string" ? requestBody.url : ""
    let normalized: string
    try {
      normalized = normalizeHttpUrl(rawUrl)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid URL" },
        { status: 400 },
      )
    }

    const { html, finalUrl } = await fetchUrlSafe(normalized)

    let extraction = await extractPageForBrand(html, finalUrl)

    const readerMd = await maybeFetchReaderMarkdown(finalUrl)
    if (readerMd?.trim()) {
      extraction = {
        ...extraction,
        visibleText: `${extraction.visibleText}\n\n--- Reader markdown ---\n${readerMd.slice(0, 12_000)}`,
      }
    }

    let draft: BrandOnboardingObject
    let llmFailed = false
    try {
      draft = await draftBrandFromPage(extraction, finalUrl, extraction.logoCandidates)
    } catch (llmError) {
      llmFailed = true
      console.error("[brand-kit/analyze-url] LLM draft failed; using static fallback", llmError)
      draft = buildFallbackBrandDraft(extraction, finalUrl)
    }

    console.info("[brand-kit/analyze-url] media", {
      finalUrl,
      images: extraction.referenceImages.length,
      videos: extraction.referenceVideos.length,
      logos: extraction.logoCandidates.length,
      llmFailed,
    })

    // Use `responseBody` (not `body`); request JSON already uses `requestBody` above.
    const responseBody = {
      draft,
      logoCandidates: extraction.logoCandidates,
      extractedTitle: extraction.title,
      extractedDescription: extraction.description,
      finalUrl,
      themeColorHint: extraction.themeColorHint,
      extractedColorCandidates: extraction.extractedColorCandidates,
      referenceImages: extraction.referenceImages,
      referenceVideos: extraction.referenceVideos,
    }
    return NextResponse.json(responseBody)
  } catch (e) {
    console.error("[brand-kit/analyze-url]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Analysis failed" },
      { status: 500 },
    )
  }
}
