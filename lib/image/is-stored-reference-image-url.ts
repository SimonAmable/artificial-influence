import { absolutizeAssetUrl } from "@/lib/assets/absolutize-asset-url"
import { validateStoredReferenceImageUrl } from "@/lib/image/stored-reference-url"

/** True when a URL is already persisted in this app's storage (not blob/data/external). */
export function isStoredReferenceImageUrl(url: string): boolean {
  try {
    validateStoredReferenceImageUrl(absolutizeAssetUrl(url))
    return true
  } catch {
    return false
  }
}
