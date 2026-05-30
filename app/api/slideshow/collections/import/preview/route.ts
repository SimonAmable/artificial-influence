import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createSlideshowCollectionImportJob,
  getSlideshowCollectionById,
} from "@/lib/slideshow/database-server"
import { previewSlideshowCollectionImportSchema } from "@/lib/slideshow/types"
import {
  scrapePinterestBoard,
  searchPinterestPins,
} from "@/lib/server/apify/pinterest-scraper"

function looksLikePinterestBoardUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      /(^|\.)pinterest\./i.test(url.hostname) &&
      url.pathname.split("/").filter(Boolean).length >= 2
    )
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = previewSlideshowCollectionImportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const collection = await getSlideshowCollectionById(supabase, user.id, parsed.data.collectionId)
    if (!collection) {
      return NextResponse.json({ error: "Slideshow collection not found." }, { status: 404 })
    }

    if (parsed.data.mode === "board_url" && !looksLikePinterestBoardUrl(parsed.data.query)) {
      return NextResponse.json({ error: "Please paste a valid Pinterest board URL." }, { status: 400 })
    }

    const rawCandidates =
      parsed.data.mode === "board_url"
        ? await scrapePinterestBoard(parsed.data.query, parsed.data.limit)
        : await searchPinterestPins(parsed.data.query, parsed.data.limit)

    const candidates = rawCandidates.slice(0, parsed.data.limit).map((candidate) => ({
      id: candidate.id,
      previewUrl: candidate.previewUrl,
      sourceUrl: candidate.sourceUrl,
      title: candidate.title,
      description: candidate.description,
      width: candidate.width,
      height: candidate.height,
      tags: candidate.tags,
    }))

    if (candidates.length === 0) {
      return NextResponse.json({ error: "No Pinterest images were found for that input." }, { status: 404 })
    }

    const job = await createSlideshowCollectionImportJob(supabase, user.id, {
      collectionId: parsed.data.collectionId,
      mode: parsed.data.mode,
      queryOrUrl: parsed.data.query,
      candidates,
    })

    return NextResponse.json({
      jobId: job.id,
      candidates: job.candidates,
    })
  } catch (error) {
    console.error("[slideshow/collections/import/preview] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to preview Pinterest import." },
      { status: 500 },
    )
  }
}
