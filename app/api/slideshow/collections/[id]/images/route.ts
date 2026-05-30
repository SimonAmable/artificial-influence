import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  appendAssetCollectionImagesSchema,
  appendUploadedCollectionImagesSchema,
} from "@/lib/slideshow/types"
import {
  appendAssetCopiesToCollection,
  appendUploadedImagesToCollection,
} from "@/lib/slideshow/database-server"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: Request, context: RouteContext) {
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

    const uploadedParse = appendUploadedCollectionImagesSchema.safeParse(body)
    if (uploadedParse.success) {
      const collection = await appendUploadedImagesToCollection(
        supabase,
        user.id,
        id,
        uploadedParse.data.uploads,
      )
      return NextResponse.json({ collection })
    }

    const assetParse = appendAssetCollectionImagesSchema.safeParse(body)
    if (assetParse.success) {
      const collection = await appendAssetCopiesToCollection(
        supabase,
        user.id,
        id,
        assetParse.data.assetIds,
      )
      return NextResponse.json({ collection })
    }

    return NextResponse.json({ error: "Invalid collection image payload." }, { status: 400 })
  } catch (error) {
    console.error("[slideshow/collections/id/images] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add collection images." },
      { status: 500 },
    )
  }
}
