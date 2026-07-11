import type { SupabaseClient } from "@supabase/supabase-js"
import { PRIVATE_UPLOAD_BUCKET, type UploadBucket } from "@/lib/uploads/shared"

/** Resolve a public or time-limited signed URL for a storage object. */
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
