import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { persistExternalImage } from "@/lib/server/persist-external-image"
import {
  appendPinterestImagesToCollection,
  deleteSlideshowCollectionImportJob,
  getSlideshowCollectionImportJobById,
} from "@/lib/slideshow/database-server"
import { commitSlideshowCollectionImportSchema } from "@/lib/slideshow/types"

function titleToSlug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 32) || "pinterest-image"
  )
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
    const parsed = commitSlideshowCollectionImportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const job = await getSlideshowCollectionImportJobById(supabase, user.id, parsed.data.jobId)
    if (!job) {
      return NextResponse.json({ error: "Pinterest import preview not found." }, { status: 404 })
    }

    if (job.targetCollectionId !== parsed.data.collectionId) {
      return NextResponse.json({ error: "That preview does not belong to this collection." }, { status: 400 })
    }

    if (new Date(job.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: "This Pinterest preview expired. Please run it again." }, { status: 410 })
    }

    const requestedIds = new Set(parsed.data.candidateIds)
    const chosen = job.candidates.filter((candidate) => requestedIds.has(candidate.id))
    if (chosen.length === 0) {
      return NextResponse.json({ error: "Choose at least one image to import." }, { status: 400 })
    }

    const persisted = []
    const failedCandidates: string[] = []
    for (const candidate of chosen) {
      try {
        const title = candidate.title?.trim() || "Pinterest image"
        const uploaded = await persistExternalImage({
          imageUrl: candidate.previewUrl,
          fileNameBase: titleToSlug(title),
          source: "slideshow-collections-pinterest",
        })

        persisted.push({
          title,
          imageUrl: uploaded.url,
          thumbnailUrl: uploaded.url,
          supabaseStoragePath: uploaded.storagePath,
          sourceUrl: candidate.sourceUrl,
          sourceQuery: job.queryOrUrl,
          width: candidate.width,
          height: candidate.height,
          tags: candidate.tags,
          metadata: {
            importJobId: job.id,
            previewUrl: candidate.previewUrl,
            description: candidate.description,
            uploadId: uploaded.uploadId,
          },
        })
      } catch (candidateError) {
        console.error("[slideshow/collections/import/commit] candidate import failed:", candidateError)
        failedCandidates.push(candidate.title?.trim() || candidate.sourceUrl)
      }
    }

    if (persisted.length === 0) {
      throw new Error("None of the selected Pinterest images could be imported.")
    }

    const collection = await appendPinterestImagesToCollection(
      supabase,
      user.id,
      parsed.data.collectionId,
      persisted,
    )

    await deleteSlideshowCollectionImportJob(supabase, user.id, job.id)

    return NextResponse.json({
      collection,
      importedCount: persisted.length,
      failedCount: failedCandidates.length,
      failedCandidates,
    })
  } catch (error) {
    console.error("[slideshow/collections/import/commit] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import Pinterest images." },
      { status: 500 },
    )
  }
}
