import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  applySlideUpdate,
  getSlideshowCollectionById,
  getSlideshowProjectById,
  updateSlideshowProject,
} from "@/lib/slideshow/database-server"
import { updateSlideshowProjectSchema } from "@/lib/slideshow/types"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const project = await getSlideshowProjectById(supabase, user.id, id)
    if (!project) {
      return NextResponse.json({ error: "Slideshow project not found." }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error("[slideshow/projects/id] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load slideshow project." },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = updateSlideshowProjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const project = await getSlideshowProjectById(supabase, user.id, id)
    if (!project) {
      return NextResponse.json({ error: "Slideshow project not found." }, { status: 404 })
    }

    let slides = parsed.data.slides

    if (parsed.data.slideUpdate) {
      const currentSlide = project.slides.find((slide) => slide.index === parsed.data.slideUpdate?.index)
      if (!currentSlide) {
        return NextResponse.json({ error: "Slide not found." }, { status: 404 })
      }

      const nextUpdate = { ...parsed.data.slideUpdate }
      if (
        nextUpdate.collectionId !== undefined ||
        nextUpdate.collectionImageId !== undefined ||
        nextUpdate.assetId !== undefined ||
        nextUpdate.assetUrl !== undefined
      ) {
        const collectionId = nextUpdate.collectionId ?? currentSlide.collectionId
        const collection = await getSlideshowCollectionById(supabase, user.id, collectionId)
        if (!collection) {
          return NextResponse.json({ error: "Collection not found." }, { status: 404 })
        }

        const collectionImageId =
          nextUpdate.collectionImageId ?? nextUpdate.assetId ?? currentSlide.collectionImageId
        const item = collection.items.find(
          (candidate) =>
            candidate.id === collectionImageId || candidate.sourceAssetId === collectionImageId,
        )
        if (!item) {
          return NextResponse.json(
            { error: "The chosen image is not part of that collection." },
            { status: 400 },
          )
        }

        nextUpdate.collectionId = collection.id
        nextUpdate.collectionImageId = item.id
        nextUpdate.assetUrl = item.url
        nextUpdate.selectionMode = nextUpdate.selectionMode ?? "manual"
      }

      slides = applySlideUpdate(project.slides, nextUpdate)
    }

    const updated = await updateSlideshowProject(supabase, user.id, id, {
      name: parsed.data.name,
      socialConnectionId: parsed.data.socialConnectionId,
      brandKitId: parsed.data.brandKitId,
      selectedHook: parsed.data.selectedHook,
      hookOptions: parsed.data.hookOptions,
      slides,
      status: parsed.data.status,
      autopostJobId: parsed.data.autopostJobId,
    })

    return NextResponse.json({ project: updated })
  } catch (error) {
    console.error("[slideshow/projects/id] PATCH error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update slideshow project." },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { error } = await supabase
      .from("slideshow_projects")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[slideshow/projects/id] DELETE error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete slideshow project." },
      { status: 500 },
    )
  }
}
