import type { AttachedRef } from "./types"

/** Prompt text: brand kits only, image assets are sent as reference files, not duplicated in Context. */
export function brandRefsOnly(refs: AttachedRef[]): AttachedRef[] {
  return refs.filter((r) => r.category === "brand")
}

export function getImageAssetUrlsFromRefChips(refs: AttachedRef[]): string[] {
  const urls = refs
    .filter((r) => r.category === "asset" && r.assetType === "image" && r.assetUrl)
    .map((r) => r.assetUrl!.trim())
    .filter(Boolean)
  return [...new Set(urls)]
}

export function getVideoAssetUrlsFromRefChips(refs: AttachedRef[]): string[] {
  const urls = refs
    .filter((r) => r.category === "asset" && r.assetType === "video" && r.assetUrl)
    .map((r) => r.assetUrl!.trim())
    .filter(Boolean)
  return [...new Set(urls)]
}

export function hasVideoOrAudioAssetRefs(refs: AttachedRef[]): boolean {
  return refs.some(
    (r) => r.category === "asset" && (r.assetType === "video" || r.assetType === "audio")
  )
}
