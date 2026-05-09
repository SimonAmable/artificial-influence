import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ASSET_CATEGORIES, inferStoragePathFromUrl, normalizeTags } from "@/lib/assets/library"
import type { AssetCategory, AssetType, AssetVisibility } from "@/lib/assets/types"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { resolveStoredObjectUrl } from "@/lib/uploads/server"

function mapAssetRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    uploadId: (row.upload_id as string | null) || null,
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

function parseLimit(rawLimit: string | null) {
  const parsed = Number.parseInt(rawLimit ?? "100", 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 100
  }

  return Math.min(Math.floor(parsed), 300)
}

function parseOffset(rawOffset: string | null) {
  const parsed = Number.parseInt(rawOffset ?? "0", 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }

  return Math.floor(parsed)
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
    const limit = parseLimit(searchParams.get("limit"))
    const offset = parseOffset(searchParams.get("offset"))

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

    let total = offset + rows.length
    let hasMore = rows.length === limit

    if (!search) {
      let countQuery = supabase
        .from("assets")
        .select("id", { count: "exact", head: true })

      if (visibility === "private") {
        countQuery = countQuery.eq("user_id", user.id)
      } else if (visibility === "public") {
        countQuery = countQuery.eq("visibility", "public")
      }

      if (category) {
        countQuery = countQuery.eq("category", category)
      }

      const { count, error: countError } = await countQuery
      if (countError) {
        console.error("[assets] GET count failed:", countError)
        return NextResponse.json(
          { error: "Failed to fetch assets", message: countError.message },
          { status: 500 },
        )
      }

      total = count ?? 0
      hasMore = offset + rows.length < total
    }

    return NextResponse.json({
      assets: rows.map((row) => mapAssetRow(row as Record<string, unknown>)),
      pagination: {
        limit,
        offset,
        returned: rows.length,
        total,
        hasMore,
      },
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
    if (!ASSET_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }
    if (!["private", "public"].includes(visibility)) {
      return NextResponse.json({ error: "Invalid visibility" }, { status: 400 })
    }

    const tags = normalizeTags(Array.isArray(body.tags) ? (body.tags as string[]) : [])
    let assetUrl = url
    let uploadId: string | null = null
    let supabaseStoragePath =
      typeof body.supabaseStoragePath === "string" && body.supabaseStoragePath.length > 0
        ? body.supabaseStoragePath
        : inferStoragePathFromUrl(url)

    if (typeof body.uploadId === "string" && body.uploadId.trim().length > 0) {
      const { data: uploadRow, error: uploadError } = await supabase
        .from("uploads")
        .select("id, bucket, storage_path")
        .eq("id", body.uploadId.trim())
        .eq("user_id", user.id)
        .maybeSingle()

      if (uploadError || !uploadRow) {
        return NextResponse.json({ error: "Referenced upload not found" }, { status: 400 })
      }

      uploadId = uploadRow.id as string
      supabaseStoragePath = uploadRow.storage_path as string
      assetUrl = await resolveStoredObjectUrl(
        createServiceRoleClient() ?? supabase,
        uploadRow.bucket as string,
        uploadRow.storage_path as string,
      )
    }

    const insertData = {
      user_id: user.id,
      title,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      asset_type: assetType,
      category,
      visibility,
      tags,
      asset_url: assetUrl,
      thumbnail_url: typeof body.thumbnailUrl === "string" ? body.thumbnailUrl : null,
      upload_id: uploadId,
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
