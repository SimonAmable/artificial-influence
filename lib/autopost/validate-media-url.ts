/**
 * Ensures a draft media URL points at this project's public-bucket object owned by the user.
 * @see https://supabase.com/docs/guides/storage/serving/downloads#public-buckets
 */
export function isUserPublicBucketMediaUrl(mediaUrl: string, userId: string, supabaseUrl: string): boolean {
  try {
    const parsed = new URL(mediaUrl)
    const base = new URL(supabaseUrl)
    if (parsed.origin !== base.origin) {
      return false
    }
    const prefix = "/storage/v1/object/public/public-bucket/"
    if (!parsed.pathname.startsWith(prefix)) {
      return false
    }
    const objectPath = decodeURIComponent(parsed.pathname.slice(prefix.length))
    return objectPath.startsWith(`${userId}/`)
  } catch {
    return false
  }
}
