/** Whether a reference image URL is already persisted (not a local blob/data URL). */
export function isPersistedReferenceImageUrl(url: string): boolean {
  const trimmed = url.trim()
  return trimmed.startsWith("https://") || trimmed.startsWith("http://")
}

/**
 * Reference images must come from this app's Supabase public bucket or app origin.
 * Matches validation used by server-side image generation tools.
 */
export function validateStoredReferenceImageUrl(url: string): void {
  if (url.startsWith("data:")) {
    return
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error("Reference image URL is invalid.")
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const isAllowedSupabaseUrl = (() => {
    if (!supabaseUrl) return false

    try {
      const parsedSupabaseUrl = new URL(supabaseUrl)
      return (
        parsedUrl.origin === parsedSupabaseUrl.origin &&
        parsedUrl.pathname.startsWith("/storage/v1/object/public/public-bucket/")
      )
    } catch {
      return false
    }
  })()

  const isAllowedAppUrl = (() => {
    if (!appUrl) return false

    try {
      const parsedAppUrl = new URL(appUrl)
      return parsedUrl.origin === parsedAppUrl.origin
    } catch {
      return false
    }
  })()

  if (!isAllowedSupabaseUrl && !isAllowedAppUrl) {
    throw new Error("Reference image URLs must come from this app's stored assets.")
  }
}
