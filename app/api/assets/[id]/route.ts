import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ASSET_CATEGORIES, inferStoragePathFromUrl, normalizeTags } from "@/lib/assets/library"
import {
  parseOptionalPrivateVoiceId,
  resolveVoiceAttachmentUpdate,
} from "@/lib/assets/private-voice"
import type { AssetCategory, AssetType, AssetVisibility } from "@/lib/assets/types"
import { mapAssetRowWithFreshUrl } from "@/lib/assets/map-asset-row"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { resolveStoredObjectUrl } from "@/lib/uploads/server"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const siteOrigin = request.nextUrl.origin
    const storageClient = createServiceRoleClient() ?? supabase

    if (body.patch === "privateVoice" || body.patch === "voice") {
      const resolved = await resolveVoiceAttachmentUpdate(supabase, user.id, {
        voiceId:
          body.patch === "privateVoice"
            ? body.privateVoiceId
              ? `private:${body.privateVoiceId}`
              : null
            : body.voiceId ?? null,
        voiceProvider:
          body.patch === "privateVoice"
            ? body.voiceProvider ?? "qwen"
            : body.voiceProvider ?? null,
        privateVoiceId: body.privateVoiceId ?? null,
      })
      if (!resolved.ok) {
        return NextResponse.json({ error: resolved.error }, { status: 400 })
      }

      // Old privateVoice-only clients may omit provider; infer from owned row when needed.
      let voiceProvider = resolved.voiceProvider
      if (body.patch === "privateVoice" && resolved.privateVoiceId && !body.voiceProvider) {
        const { data: owned } = await supabase
          .from("private_audio_voices")
          .select("provider")
          .eq("id", resolved.privateVoiceId)
          .eq("user_id", user.id)
          .maybeSingle()
        if (owned?.provider === "qwen" || owned?.provider === "google") {
          voiceProvider = owned.provider
        }
      }

      if (resolved.voiceId && !voiceProvider) {
        return NextResponse.json({ error: "Voice provider is required" }, { status: 400 })
      }

      const { data, error } = await supabase
        .from("assets")
        .update({
          private_voice_id: resolved.privateVoiceId,
          voice_id: resolved.voiceId,
          voice_provider: voiceProvider,
          updated_at: new Date().toISOString(),
        })
        .eq("id", assetId)
        .eq("user_id", user.id)
        .select("*")
        .single()

      if (error || !data) {
        console.error("[assets] PATCH voice failed:", error)
        return NextResponse.json(
          { error: "Failed to update character voice", message: error?.message },
          { status: 500 },
        )
      }

      return NextResponse.json({
        asset: await mapAssetRowWithFreshUrl(storageClient, data as Record<string, unknown>, {
          siteOrigin,
        }),
      })
    }

    const title = String(body.title || "").trim()
    const url = String(body.url || "").trim()
    const assetType = body.assetType as AssetType
    const category = body.category as AssetCategory
    const visibility = (body.visibility ?? "private") as AssetVisibility

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
    if (visibility === "public") {
      return NextResponse.json({ error: "Public assets are disabled" }, { status: 400 })
    }

    const tags = normalizeTags(Array.isArray(body.tags) ? (body.tags as string[]) : [])
    let assetUrl = url
    let uploadId: string | null | undefined
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
        storageClient,
        uploadRow.bucket as string,
        uploadRow.storage_path as string,
      )
    }

    const thumbnailUrl =
      typeof body.thumbnailUrl === "string" && body.thumbnailUrl.trim().length > 0
        ? body.thumbnailUrl.trim()
        : null

    const privateVoiceId = parseOptionalPrivateVoiceId(body.privateVoiceId)
    if (body.privateVoiceId !== undefined && privateVoiceId === undefined) {
      return NextResponse.json({ error: "Invalid private voice id" }, { status: 400 })
    }

    const hasVoiceFields =
      body.voiceId !== undefined ||
      body.voiceProvider !== undefined ||
      body.privateVoiceId !== undefined

    let voiceAttachment:
      | {
          privateVoiceId: string | null
          voiceId: string | null
          voiceProvider: string | null
        }
      | null = null

    if (hasVoiceFields) {
      const resolved = await resolveVoiceAttachmentUpdate(supabase, user.id, {
        voiceId:
          body.voiceId !== undefined
            ? body.voiceId
            : privateVoiceId
              ? `private:${privateVoiceId}`
              : null,
        voiceProvider: body.voiceProvider ?? (privateVoiceId ? "qwen" : null),
        privateVoiceId: privateVoiceId ?? null,
      })
      if (!resolved.ok) {
        return NextResponse.json({ error: resolved.error }, { status: 400 })
      }
      voiceAttachment = resolved
      if (voiceAttachment.privateVoiceId && !body.voiceProvider) {
        const { data: owned } = await supabase
          .from("private_audio_voices")
          .select("provider")
          .eq("id", voiceAttachment.privateVoiceId)
          .eq("user_id", user.id)
          .maybeSingle()
        if (owned?.provider === "qwen" || owned?.provider === "google") {
          voiceAttachment = {
            ...voiceAttachment,
            voiceProvider: owned.provider,
          }
        }
      }
    }

    const updateData: Record<string, unknown> = {
      title,
      asset_type: assetType,
      category,
      visibility: "private",
      tags,
      asset_url: assetUrl,
      thumbnail_url: thumbnailUrl,
      supabase_storage_path: supabaseStoragePath,
      source_node_type: typeof body.sourceNodeType === "string" ? body.sourceNodeType : null,
      source_generation_id: typeof body.sourceGenerationId === "string" ? body.sourceGenerationId : null,
      metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {},
      updated_at: new Date().toISOString(),
    }

    if ("description" in body) {
      updateData.description =
        typeof body.description === "string" ? body.description.trim() || null : null
    }

    if (uploadId !== undefined) {
      updateData.upload_id = uploadId
    }

    if (voiceAttachment) {
      updateData.private_voice_id = voiceAttachment.privateVoiceId
      updateData.voice_id = voiceAttachment.voiceId
      updateData.voice_provider = voiceAttachment.voiceProvider
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

    return NextResponse.json({
      asset: await mapAssetRowWithFreshUrl(storageClient, data as Record<string, unknown>, {
        siteOrigin,
      }),
    })
  } catch (error) {
    console.error("[assets] PATCH exception:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
