import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { inferStoragePathFromUrl, normalizeTags } from "@/lib/assets/library"
import type { AssetCategory, AssetType, AssetVisibility } from "@/lib/assets/types"

function mapAssetRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    title: (row.title as string) || "Untitled Asset",
    description: (row.description as string | null) || null,
    assetType: row.asset_type as AssetType,
    category: row.category as AssetCategory,
    visibility: row.visibility as AssetVisibility,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    url: row.asset_url as string,
    thumbnailUrl: (row.thumbnail_url as string | null) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    sourceNodeType: (row.source_node_type as string | null) || null,
    sourceGenerationId: (row.source_generation_id as string | null) || null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const visibility = searchParams.get("visibility") as AssetVisibility | null
    const category = searchParams.get("category") as AssetCategory | null
    const search = (searchParams.get("search") || "").trim().toLowerCase()
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 300)
    const offset = parseInt(searchParams.get("offset") || "0", 10)

    let query = supabase
      .from("assets")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (visibility === "private") {
      query = query.eq("user_id", user.id)
    } else if (visibility === "public") {
      query = query.eq("visibility", "public")
    }

    if (category) {
      query = query.eq("category", category)
    }

    const { data, error } = await query
    if (error) {
      console.error("[assets] GET failed:", error)
      return NextResponse.json({ error: "Failed to fetch assets", message: error.message }, { status: 500 })
    }

    const rows = (data || []).filter((row) => {
      if (!search) return true
      const title = String(row.title || "").toLowerCase()
      const tags = Array.isArray(row.tags) ? (row.tags as string[]).join(" ").toLowerCase() : ""
      return title.includes(search) || tags.includes(search)
    })

    return NextResponse.json({
      assets: rows.map((row) => mapAssetRow(row as Record<string, unknown>)),
    })
  } catch (error) {
    console.error("[assets] GET exception:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const body = await request.json()
    const title = String(body.title || "").trim()
    const url = String(body.url || "").trim()
    const assetType = body.assetType as AssetType
    const category = body.category as AssetCategory
    const visibility = body.visibility as AssetVisibility

    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })
    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 })
    if (!["image", "video", "audio"].includes(assetType)) {
      return NextResponse.json({ error: "Invalid asset type" }, { status: 400 })
    }
    if (!["character", "scene", "texture", "motion", "audio"].includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }
    if (!["private", "public"].includes(visibility)) {
      return NextResponse.json({ error: "Invalid visibility" }, { status: 400 })
    }

    const tags = normalizeTags(Array.isArray(body.tags) ? (body.tags as string[]) : [])
    const supabaseStoragePath =
      typeof body.supabaseStoragePath === "string" && body.supabaseStoragePath.length > 0
        ? body.supabaseStoragePath
        : inferStoragePathFromUrl(url)

    const insertData = {
      user_id: user.id,
      title,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      asset_type: assetType,
      category,
      visibility,
      tags,
      asset_url: url,
      thumbnail_url: typeof body.thumbnailUrl === "string" ? body.thumbnailUrl : null,
      supabase_storage_path: supabaseStoragePath,
      source_node_type: typeof body.sourceNodeType === "string" ? body.sourceNodeType : null,
      source_generation_id: typeof body.sourceGenerationId === "string" ? body.sourceGenerationId : null,
      metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {},
    }

    const { data, error } = await supabase
      .from("assets")
      .insert(insertData)
      .select("*")
      .single()

    if (error || !data) {
      console.error("[assets] POST failed:", error)
      return NextResponse.json({ error: "Failed to create asset", message: error?.message }, { status: 500 })
    }

    return NextResponse.json({ asset: mapAssetRow(data as Record<string, unknown>) })
  } catch (error) {
    console.error("[assets] POST exception:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
