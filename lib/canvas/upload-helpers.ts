import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  DEFAULT_UPLOAD_BUCKET,
  type FinalizeUploadRequest,
  type RegisterUploadRequest,
  type RegisterUploadResponse,
  type UploadBucket,
  type UploadFileType,
} from '@/lib/uploads/shared'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export interface UploadResult {
  uploadId: string
  bucket: UploadBucket
  storagePath: string
  url: string
  fileName: string
  fileType: UploadFileType
  mimeType: string
  sizeBytes: number
  deduped: boolean
}

export interface UploadHelperOptions {
  bucket?: UploadBucket
}

async function hashFile(file: Blob) {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto is not available in this browser")
  }

  const arrayBuffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest("SHA-256", arrayBuffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function isRegisterUploadResponse(value: unknown): value is RegisterUploadResponse {
  if (!value || typeof value !== "object") return false
  return "status" in value
}

/**
 * Upload a file to Supabase Storage and return the public URL
 * @param file - File to upload
 * @param folder - Folder path within user's directory (e.g., 'uploads', 'reference-images')
 * @returns Promise with upload result or null if failed
 */
export async function uploadFileToSupabase(
  file: File,
  folder: string = 'uploads',
  options?: UploadHelperOptions,
): Promise<UploadResult | null> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    toast.error(`File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`)
    return null
  }

  // Get authenticated user
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    toast.error('Please log in to upload files')
    return null
  }

  // Determine file type
  let fileType: 'image' | 'video' | 'audio' | 'other' = 'other'
  if (file.type.startsWith('image/')) fileType = 'image'
  else if (file.type.startsWith('video/')) fileType = 'video'
  else if (file.type.startsWith('audio/')) fileType = 'audio'

  // Generate unique filename
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(7)
  const ext = file.name.split('.').pop() || 'bin'
  const filename = `${timestamp}-${randomStr}.${ext}`
  const bucket = options?.bucket ?? DEFAULT_UPLOAD_BUCKET

  try {
    const contentHash = await hashFile(file)
    const registerPayload: RegisterUploadRequest = {
      bucket,
      source: folder,
      contentHash,
      fileName: file.name || filename,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }

    const registerResponse = await fetch('/api/uploads/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerPayload),
    })

    const registerJson = (await registerResponse.json().catch(() => ({}))) as
      | RegisterUploadResponse
      | { error?: string }

    if (!registerResponse.ok) {
      throw new Error(
        typeof registerJson === 'object' && registerJson && 'error' in registerJson && registerJson.error
          ? registerJson.error
          : `Failed to prepare ${file.name}`,
      )
    }

    if (!isRegisterUploadResponse(registerJson)) {
      throw new Error(`Failed to prepare ${file.name}`)
    }

    if (registerJson.status === 'existing') {
      return registerJson.upload
    }

    const uploadToSigned = await supabase.storage
      .from(registerJson.bucket)
      .uploadToSignedUrl(registerJson.storagePath, registerJson.token, file, {
        contentType: file.type,
        upsert: false,
        cacheControl: "31536000",
      })

    if (uploadToSigned.error) {
      throw new Error(uploadToSigned.error.message)
    }

    const finalizePayload: FinalizeUploadRequest = {
      bucket,
      source: folder,
      contentHash,
      storagePath: registerJson.storagePath,
      fileName: file.name || filename,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }

    const finalizeResponse = await fetch('/api/uploads/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalizePayload),
    })

    const finalizeJson = (await finalizeResponse.json().catch(() => ({}))) as
      | { upload?: UploadResult; error?: string }
      | undefined

    if (!finalizeResponse.ok || !finalizeJson?.upload) {
      throw new Error(finalizeJson?.error || `Failed to finalize ${file.name}`)
    }

    return {
      ...finalizeJson.upload,
      fileName: finalizeJson.upload.fileName || file.name,
      fileType: finalizeJson.upload.fileType || fileType,
    }
  } catch (error) {
    console.error('Upload error:', error)
    toast.error(error instanceof Error ? error.message : `Failed to upload ${file.name}`)
    return null
  }
}

/**
 * Upload a Blob to Supabase Storage and return the public URL
 * @param blob - Blob to upload
 * @param filename - Filename to use for storage
 * @param folder - Folder path within user's directory
 * @returns Promise with upload result or null if failed
 */
export async function uploadBlobToSupabase(
  blob: Blob,
  filename: string,
  folder: string = 'uploads',
  options?: UploadHelperOptions,
): Promise<UploadResult | null> {
  const safeName = filename && filename.trim().length > 0 ? filename : `upload-${Date.now()}`
  const file = new File([blob], safeName, { type: blob.type || 'application/octet-stream' })
  return uploadFileToSupabase(file, folder, options)
}

/**
 * Upload multiple files to Supabase Storage
 * @param files - Array of files to upload
 * @param folder - Folder path within user's directory
 * @returns Promise with array of successful upload results
 */
export async function uploadFilesToSupabase(
  files: File[],
  folder: string = 'uploads',
  options?: UploadHelperOptions,
): Promise<UploadResult[]> {
  const results: UploadResult[] = []

  for (const file of files) {
    const result = await uploadFileToSupabase(file, folder, options)
    if (result) {
      results.push(result)
    }
  }

  return results
}
