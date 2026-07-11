import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  DEFAULT_UPLOAD_BUCKET,
  PRIVATE_UPLOAD_BUCKET,
  type UploadBucket,
} from "@/lib/uploads/shared"
import { extractStorageObjectRef } from "@/lib/uploads/storage-ref"
import { absolutizeAssetUrl } from "@/lib/assets/resolve-asset-access-url"

export type LibraryContentKind = "asset" | "history" | "upload"

function mimeFromPath(storagePath: string, fallback = "application/octet-stream") {
  const lower = storagePath.toLowerCase()
  if (/\.(png)$/.test(lower)) return "image/png"
  if (/\.(jpe?g)$/.test(lower)) return "image/jpeg"
  if (/\.(webp)$/.test(lower)) return "image/webp"
  if (/\.(gif)$/.test(lower)) return "image/gif"
  if (/\.(mp4)$/.test(lower)) return "video/mp4"
  if (/\.(webm)$/.test(lower)) return "video/webm"
  if (/\.(mp3)$/.test(lower)) return "audio/mpeg"
  if (/\.(wav)$/.test(lower)) return "audio/wav"
  if (/\.(m4a)$/.test(lower)) return "audio/mp4"
  return fallback
}

function parseKind(raw: string | null): LibraryContentKind | null {
  if (raw === "asset" || raw === "history" || raw === "upload") return raw
  return null
}

async function downloadFromStorage(
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>> | Awaited<ReturnType<typeof createClient>>,
  bucket: UploadBucket,
  storagePath: string,
) {
  const { data, error } = await supabase.storage.from(bucket).download(storagePath)
  if (error || !data) {
    throw new Error(error?.message || "Failed to download media")
  }
  return data
}

/**
 * Auth-gated binary proxy for library picks (assets / history / uploads).
 * Avoids client-side fetch of expired signed URLs or CORS/private-bucket failures.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const kind = parseKind(request.nextUrl.searchParams.get("kind"))
    const id = (request.nextUrl.searchParams.get("id") || "").trim()
    if (!kind || !id) {
      return NextResponse.json({ error: "kind and id are required" }, { status: 400 })
    }

    const storageClient = createServiceRoleClient() ?? supabase
    let bucket: UploadBucket = DEFAULT_UPLOAD_BUCKET
    let storagePath: string | null = null
    let filename = "library-media"
    let mimeType = "application/octet-stream"

    if (kind === "asset") {
      const { data: asset, error } = await supabase
        .from("assets")
        .select("id, user_id, upload_id, asset_url, supabase_storage_path, title, asset_type")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle()

      if (error || !asset) {
        return NextResponse.json({ error: "Asset not found" }, { status: 404 })
      }

      filename = String(asset.title || "asset").replace(/[^\w.-]+/g, "_") || "asset"

      if (asset.upload_id) {
        const { data: upload } = await supabase
          .from("uploads")
          .select("bucket, storage_path, mime_type, original_filename")
          .eq("id", asset.upload_id)
          .eq("user_id", user.id)
          .maybeSingle()

        if (upload?.storage_path) {
          bucket = upload.bucket as UploadBucket
          storagePath = upload.storage_path as string
          mimeType = (upload.mime_type as string) || mimeFromPath(storagePath)
          if (upload.original_filename) {
            filename = String(upload.original_filename)
          }
        }
      }

      if (!storagePath) {
        const path = typeof asset.supabase_storage_path === "string" ? asset.supabase_storage_path.trim() : ""
        const ref = extractStorageObjectRef(absolutizeAssetUrl(String(asset.asset_url || "")))
        if (path) {
          storagePath = path
          bucket = ref?.bucket || PRIVATE_UPLOAD_BUCKET
        } else if (ref) {
          storagePath = ref.storagePath
          bucket = ref.bucket
        }
      }

      if (!storagePath) {
        return NextResponse.json({ error: "Asset has no stored file" }, { status: 404 })
      }

      mimeType = mimeType === "application/octet-stream" ? mimeFromPath(storagePath) : mimeType
    } else if (kind === "history") {
      const { data: generation, error } = await supabase
        .from("generations")
        .select("id, supabase_storage_path, type, prompt")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle()

      if (error || !generation?.supabase_storage_path) {
        return NextResponse.json({ error: "Generation not found" }, { status: 404 })
      }

      bucket = DEFAULT_UPLOAD_BUCKET
      storagePath = String(generation.supabase_storage_path)
      mimeType = mimeFromPath(storagePath, generation.type === "video" ? "video/mp4" : "image/png")
      filename = String(generation.prompt || "generation").slice(0, 40).replace(/[^\w.-]+/g, "_") || "generation"
    } else {
      const { data: upload, error } = await supabase
        .from("uploads")
        .select("bucket, storage_path, mime_type, original_filename")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle()

      if (error || !upload?.storage_path) {
        return NextResponse.json({ error: "Upload not found" }, { status: 404 })
      }

      bucket = upload.bucket as UploadBucket
      storagePath = upload.storage_path as string
      mimeType = (upload.mime_type as string) || mimeFromPath(storagePath)
      filename = String(upload.original_filename || "upload")
    }

    const blob = await downloadFromStorage(storageClient, bucket, storagePath)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const contentType = blob.type || mimeType

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      },
    })
  } catch (error) {
    console.error("[library/content] GET exception:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load media" },
      { status: 500 },
    )
  }
}
