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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const resolvedParams = await Promise.resolve(params)
    const assetId = resolvedParams.id
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

    const updateData = {
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
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("assets")
      .update(updateData)
      .eq("id", assetId)
      .eq("user_id", user.id)
      .select("*")
      .single()

    if (error || !data) {
      console.error("[assets] PATCH failed:", error)
      return NextResponse.json({ error: "Failed to update asset", message: error?.message }, { status: 500 })
    }

    return NextResponse.json({ asset: mapAssetRow(data as Record<string, unknown>) })
  } catch (error) {
    console.error("[assets] PATCH exception:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const resolvedParams = await Promise.resolve(params)
    const assetId = resolvedParams.id

    const { data: asset, error: fetchError } = await supabase
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !asset) {
      return NextResponse.json({ error: "Asset not found or unauthorized" }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from("assets")
      .delete()
      .eq("id", assetId)
      .eq("user_id", user.id)

    if (deleteError) {
      console.error("[assets] DELETE failed:", deleteError)
      return NextResponse.json({ error: "Failed to delete asset", message: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[assets] DELETE exception:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
