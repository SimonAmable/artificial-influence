import { absolutizeAssetUrl } from "@/lib/assets/absolutize-asset-url"
import { extractStorageObjectRef } from "@/lib/uploads/storage-ref"

/** Whether a reference image URL is already persisted (not a local blob/data URL). */
export function isPersistedReferenceImageUrl(url: string): boolean {
  const trimmed = url.trim()
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) return true
  // Same-origin / relative storage paths returned by older asset APIs
  if (trimmed.startsWith("/storage/v1/") || trimmed.startsWith("/")) return true
  return false
}

function isAllowedSupabaseStoragePath(pathname: string): boolean {
  return (
    pathname.startsWith("/storage/v1/object/public/") ||
    pathname.startsWith("/storage/v1/object/sign/") ||
    pathname.startsWith("/storage/v1/render/image/public/") ||
    Boolean(pathname.match(/^\/(public-bucket|private-bucket)\//))
  )
}

/**
 * Reference images must come from this app's Supabase storage or app origin.
 * Accepts public, signed, and render URLs; relative same-origin paths are absolutized first.
 */
export function validateStoredReferenceImageUrl(url: string): void {
  if (url.startsWith("data:")) {
    return
  }

  const absolute = absolutizeAssetUrl(url)
  let parsedUrl: URL

  try {
    parsedUrl = new URL(absolute)
  } catch {
    throw new Error("Reference image URL is invalid.")
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const isAllowedSupabaseUrl = (() => {
    if (!supabaseUrl) return false

    try {
      const parsedSupabaseUrl = new URL(supabaseUrl)
      if (parsedUrl.origin !== parsedSupabaseUrl.origin) return false
      if (isAllowedSupabaseStoragePath(parsedUrl.pathname)) return true
      // Also accept any URL we can map back to a storage object
      return extractStorageObjectRef(absolute) !== null
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
