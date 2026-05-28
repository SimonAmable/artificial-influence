import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  deleteSlideshowCollection,
  getSlideshowCollectionById,
  updateSlideshowCollection,
} from "@/lib/slideshow/database-server"
import { updateSlideshowCollectionSchema } from "@/lib/slideshow/types"

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

    const collection = await getSlideshowCollectionById(supabase, user.id, id)
    if (!collection) {
      return NextResponse.json({ error: "Slideshow collection not found." }, { status: 404 })
    }

    return NextResponse.json({ collection })
  } catch (error) {
    console.error("[slideshow/collections/id] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load slideshow collection." },
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
    const parsed = updateSlideshowCollectionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const collection = await updateSlideshowCollection(supabase, user.id, id, parsed.data)
    return NextResponse.json({ collection })
  } catch (error) {
    console.error("[slideshow/collections/id] PATCH error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update slideshow collection." },
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

    await deleteSlideshowCollection(supabase, user.id, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[slideshow/collections/id] DELETE error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete slideshow collection." },
      { status: 500 },
    )
  }
}
