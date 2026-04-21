import { createHash } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { assertAcceptedCurrentTerms } from "@/lib/legal/terms-acceptance"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  DEFAULT_UPLOAD_BUCKET,
  PRIVATE_UPLOAD_BUCKET,
  type FinalizeUploadRequest,
  type RegisterUploadRequest,
  type RegisterUploadResponse,
  type UploadBucket,
  type UploadFileType,
  type UploadResponsePayload,
} from "@/lib/uploads/shared"

type UploadRow = {
  id: string
  bucket: string
  storage_path: string
  mime_type: string
  original_filename: string | null
  size_bytes: number | null
}

function getFileTypeFromMimeType(mimeType: string): UploadFileType {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"
  return "other"
}

function sanitizeExtension(fileName: string, mimeType: string) {
  const extFromName = fileName.split(".").pop()?.trim().toLowerCase()
  if (extFromName && /^[a-z0-9]{1,10}$/.test(extFromName)) {
    return extFromName
  }

  const subtype = mimeType.split("/")[1]?.trim().toLowerCase()
  if (!subtype) return "bin"
  const normalized = subtype.split("+")[0]?.replace(/[^a-z0-9]/g, "")
  return normalized && normalized.length > 0 ? normalized : "bin"
}

function normalizeBucket(bucket: UploadBucket | undefined) {
  return bucket && bucket.trim().length > 0 ? bucket.trim() : DEFAULT_UPLOAD_BUCKET
}

function normalizeSource(source: string | undefined) {
  return source && source.trim().length > 0 ? source.trim() : "uploads"
}

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error("Unauthorized")
  }

  const termsResponse = await assertAcceptedCurrentTerms(supabase, user.id)
  if (termsResponse) {
    throw new Error("Terms acceptance required")
  }

  return { supabase, user }
}

async function storageObjectExists(
  supabase: SupabaseClient,
  bucket: UploadBucket,
  storagePath: string,
) {
  const { data, error } = await supabase.storage.from(bucket).exists(storagePath)
  if (error) return false
  return Boolean(data)
}

export async function resolveStoredObjectUrl(
  supabase: SupabaseClient,
  bucket: UploadBucket,
  storagePath: string,
) {
  if (bucket !== PRIVATE_UPLOAD_BUCKET) {
    return supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl
  }

  const signed = await supabase.storage.from(bucket).createSignedUrl(storagePath, 60 * 60)
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(signed.error?.message || "Failed to create signed URL")
  }
  return signed.data.signedUrl
}

function mapUploadRowToResponse(row: UploadRow, url: string, deduped: boolean): UploadResponsePayload {
  return {
    uploadId: row.id,
    bucket: row.bucket,
    storagePath: row.storage_path,
    url,
    mimeType: row.mime_type,
    fileName: row.original_filename || row.storage_path.split("/").pop() || "upload",
    fileType: getFileTypeFromMimeType(row.mime_type),
    sizeBytes: row.size_bytes ?? 0,
    deduped,
  }
}

async function findUploadByHash(
  supabase: SupabaseClient,
  userId: string,
  bucket: UploadBucket,
  contentHash: string,
) {
  const { data, error } = await supabase
    .from("uploads")
    .select("id, bucket, storage_path, mime_type, original_filename, size_bytes")
    .eq("user_id", userId)
    .eq("bucket", bucket)
    .eq("content_hash", contentHash)
    .maybeSingle()

  if (error || !data) return null
  return data as UploadRow
}

async function deleteUploadRow(supabase: SupabaseClient, uploadId: string, userId: string) {
  await supabase.from("uploads").delete().eq("id", uploadId).eq("user_id", userId)
}

async function getReusableUpload(
  supabase: SupabaseClient,
  userId: string,
  bucket: UploadBucket,
  contentHash: string,
) {
  const existing = await findUploadByHash(supabase, userId, bucket, contentHash)
  if (!existing) return null

  const storageClient = createServiceRoleClient() ?? supabase
  const exists = await storageObjectExists(storageClient, existing.bucket, existing.storage_path)
  if (!exists) {
    await deleteUploadRow(supabase, existing.id, userId)
    return null
  }

  const url = await resolveStoredObjectUrl(storageClient, existing.bucket, existing.storage_path)
  return mapUploadRowToResponse(existing, url, true)
}

function buildDeterministicStoragePath(
  userId: string,
  contentHash: string,
  fileName: string,
  mimeType: string,
) {
  const extension = sanitizeExtension(fileName, mimeType)
  return `${userId}/user-uploads/${contentHash}.${extension}`
}

export async function prepareDirectUpload(
  input: RegisterUploadRequest,
): Promise<RegisterUploadResponse> {
  const { supabase, user } = await getAuthenticatedUser()
  const bucket = normalizeBucket(input.bucket)
  const reusable = await getReusableUpload(supabase, user.id, bucket, input.contentHash)
  if (reusable) {
    return { status: "existing", upload: reusable }
  }

  const storagePath = buildDeterministicStoragePath(
    user.id,
    input.contentHash,
    input.fileName,
    input.mimeType,
  )

  const storageClient = createServiceRoleClient() ?? supabase
  const alreadyExists = await storageObjectExists(storageClient, bucket, storagePath)

  if (alreadyExists) {
    const finalized = await finalizeUploadedObject({
      bucket,
      source: input.source,
      contentHash: input.contentHash,
      storagePath,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    })
    return { status: "existing", upload: { ...finalized, deduped: true } }
  }

  const signed = await supabase.storage.from(bucket).createSignedUploadUrl(storagePath, {
    upsert: false,
  })

  if (signed.error || !signed.data?.token) {
    throw new Error(signed.error?.message || "Failed to create signed upload URL")
  }

  return {
    status: "upload-required",
    bucket,
    storagePath,
    token: signed.data.token,
  }
}

export async function finalizeUploadedObject(
  input: FinalizeUploadRequest,
): Promise<UploadResponsePayload> {
  const { supabase, user } = await getAuthenticatedUser()
  const bucket = normalizeBucket(input.bucket)
  const reusable = await getReusableUpload(supabase, user.id, bucket, input.contentHash)
  if (reusable) {
    return reusable
  }

  const storageClient = createServiceRoleClient() ?? supabase
  const exists = await storageObjectExists(storageClient, bucket, input.storagePath)
  if (!exists) {
    throw new Error("Uploaded object was not found in storage")
  }

  const originalFileName = input.fileName.trim().length > 0 ? input.fileName.trim() : null
  const label = originalFileName ? `Uploaded: ${originalFileName}` : "User upload"

  const { data, error } = await supabase
    .from("uploads")
    .insert({
      user_id: user.id,
      source: normalizeSource(input.source),
      bucket,
      storage_path: input.storagePath,
      mime_type: input.mimeType,
      label,
      size_bytes: input.sizeBytes,
      content_hash: input.contentHash,
      original_filename: originalFileName,
    })
    .select("id, bucket, storage_path, mime_type, original_filename, size_bytes")
    .single()

  let row = data as UploadRow | null

  if (error) {
    if (error.code !== "23505") {
      throw new Error(error.message)
    }

    const existing = await findUploadByHash(supabase, user.id, bucket, input.contentHash)
    if (!existing) {
      throw new Error("Upload already exists but could not be loaded")
    }
    row = existing
  }

  if (!row) {
    throw new Error("Failed to persist upload")
  }

  const url = await resolveStoredObjectUrl(storageClient, row.bucket, row.storage_path)
  return {
    uploadId: row.id,
    bucket: row.bucket,
    storagePath: row.storage_path,
    url,
    mimeType: row.mime_type,
    fileName: row.original_filename || input.fileName || "upload",
    fileType: getFileTypeFromMimeType(row.mime_type),
    sizeBytes: row.size_bytes ?? input.sizeBytes,
    deduped: false,
  }
}

export async function storeUploadedFileFromServer(input: {
  bucket?: UploadBucket
  source?: string
  fileName: string
  mimeType: string
  bytes: ArrayBuffer
}) {
  const { supabase, user } = await getAuthenticatedUser()
  const bucket = normalizeBucket(input.bucket)
  const buffer = Buffer.from(input.bytes)
  const contentHash = createHash("sha256").update(buffer).digest("hex")

  const reusable = await getReusableUpload(supabase, user.id, bucket, contentHash)
  if (reusable) {
    return reusable
  }

  const storagePath = buildDeterministicStoragePath(user.id, contentHash, input.fileName, input.mimeType)
  const storageClient = createServiceRoleClient() ?? supabase
  const exists = await storageObjectExists(storageClient, bucket, storagePath)

  if (!exists) {
    const upload = await storageClient.storage.from(bucket).upload(storagePath, buffer, {
      contentType: input.mimeType,
      upsert: false,
    })

    if (upload.error) {
      throw new Error(upload.error.message)
    }
  }

  return finalizeUploadedObject({
    bucket,
    source: input.source,
    contentHash,
    storagePath,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: buffer.byteLength,
  })
}
