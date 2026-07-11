import type { AssetSelectionPick } from "@/components/shared/modals/asset-selection-modal"

function extensionForMime(mimeType: string, assetType: AssetSelectionPick["assetType"]) {
  const subtype = mimeType.split("/")[1]?.split("+")[0]?.toLowerCase()
  if (subtype && /^[a-z0-9]{1,10}$/.test(subtype)) {
    if (subtype === "jpeg") return "jpg"
    return subtype
  }
  if (assetType === "video") return "mp4"
  if (assetType === "audio") return "mp3"
  return "png"
}

function fallbackMime(assetType: AssetSelectionPick["assetType"]) {
  if (assetType === "video") return "video/mp4"
  if (assetType === "audio") return "audio/mpeg"
  return "image/png"
}

/**
 * Load a library pick as a File via the auth-gated proxy when possible,
 * falling back to a direct URL fetch for legacy URL-only picks.
 */
export async function fetchLibraryPickAsFile(pick: AssetSelectionPick): Promise<File> {
  const titleStem = (pick.title || "library-media").replace(/[^\w.-]+/g, "_").slice(0, 48) || "library-media"

  if (pick.id && pick.source) {
    const params = new URLSearchParams({
      kind: pick.source === "history" ? "history" : pick.source,
      id: pick.id,
    })
    const response = await fetch(`/api/library/content?${params.toString()}`)
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(
        typeof payload.error === "string" ? payload.error : `Failed to load library media (${response.status})`,
      )
    }
    const blob = await response.blob()
    const mimeType = blob.type || fallbackMime(pick.assetType)
    const ext = extensionForMime(mimeType, pick.assetType)
    return new File([blob], `${titleStem}.${ext}`, { type: mimeType })
  }

  const response = await fetch(pick.url)
  if (!response.ok) {
    throw new Error(`Failed to fetch media (${response.status})`)
  }
  const blob = await response.blob()
  const mimeType = blob.type || fallbackMime(pick.assetType)
  const ext = extensionForMime(mimeType, pick.assetType)
  return new File([blob], `${titleStem}.${ext}`, { type: mimeType })
}

/**
 * Prefer a durable absolute URL from the pick; when a File is needed for local
 * editing (image editor), use {@link fetchLibraryPickAsFile}.
 */
export function libraryPickAccessUrl(pick: AssetSelectionPick): string {
  return pick.url
}
