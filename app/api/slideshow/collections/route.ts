import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createSlideshowCollection,
  listSlideshowCollections,
} from "@/lib/slideshow/database-server"
import { createSlideshowCollectionSchema } from "@/lib/slideshow/types"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const collections = await listSlideshowCollections(supabase, user.id)
    return NextResponse.json({ collections })
  } catch (error) {
    console.error("[slideshow/collections] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load slideshow collections." },
      { status: 500 },
    )
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
    const parsed = createSlideshowCollectionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const collection = await createSlideshowCollection(supabase, user.id, parsed.data)
    return NextResponse.json({ collection })
  } catch (error) {
    console.error("[slideshow/collections] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create slideshow collection." },
      { status: 500 },
    )
  }
}
