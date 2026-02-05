import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export interface UploadResult {
  url: string
  fileName: string
  fileType: 'image' | 'video' | 'audio' | 'other'
}

/**
 * Upload a file to Supabase Storage and return the public URL
 * @param file - File to upload
 * @param folder - Folder path within user's directory (e.g., 'uploads', 'reference-images')
 * @returns Promise with upload result or null if failed
 */
export async function uploadFileToSupabase(
  file: File,
  folder: string = 'uploads'
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
  const storagePath = `${user.id}/${folder}/${filename}`

  try {
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('public-bucket')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      toast.error(`Failed to upload ${file.name}`)
      return null
    }

    // Get permanent public URL
    const { data: urlData } = supabase.storage
      .from('public-bucket')
      .getPublicUrl(storagePath)

    return {
      url: urlData.publicUrl,
      fileName: file.name,
      fileType,
    }
  } catch (error) {
    console.error('Upload error:', error)
    toast.error(`Failed to upload ${file.name}`)
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
  folder: string = 'uploads'
): Promise<UploadResult | null> {
  const safeName = filename && filename.trim().length > 0 ? filename : `upload-${Date.now()}`
  const file = new File([blob], safeName, { type: blob.type || 'application/octet-stream' })
  return uploadFileToSupabase(file, folder)
}

/**
 * Upload multiple files to Supabase Storage
 * @param files - Array of files to upload
 * @param folder - Folder path within user's directory
 * @returns Promise with array of successful upload results
 */
export async function uploadFilesToSupabase(
  files: File[],
  folder: string = 'uploads'
): Promise<UploadResult[]> {
  const results: UploadResult[] = []

  for (const file of files) {
    const result = await uploadFileToSupabase(file, folder)
    if (result) {
      results.push(result)
    }
  }

  return results
}
