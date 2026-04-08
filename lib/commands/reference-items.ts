import type { AssetRecord } from "@/lib/assets/types"
import { formatBrandKitForPrompt } from "@/lib/brand-kit/format-for-prompt"
import type { BrandKit } from "@/lib/brand-kit/types"
import type { ReferenceItem } from "./types"

function pickBrandPreviewUrl(kit: BrandKit): string | null {
  const u =
    kit.logoUrl?.trim() ||
    kit.logoDarkUrl?.trim() ||
    kit.iconUrl?.trim() ||
    kit.iconDarkUrl?.trim() ||
    null
  return u || null
}

function pickAssetPreviewUrl(asset: AssetRecord): string | null {
  if (asset.thumbnailUrl?.trim()) return asset.thumbnailUrl.trim()
  if (asset.assetType === "image") return asset.url?.trim() || null
  return asset.url?.trim() || null
}

export function brandKitToReferenceItem(kit: BrandKit): ReferenceItem {
  return {
    id: `brand:${kit.id}`,
    label: kit.name,
    subtitle: kit.isDefault ? "Default brand kit" : "Brand kit",
    category: "brand",
    previewUrl: pickBrandPreviewUrl(kit),
    serialized: formatBrandKitForPrompt(kit),
  }
}

export function assetToReferenceItem(asset: AssetRecord): ReferenceItem {
  return {
    id: `asset:${asset.id}`,
    label: asset.title,
    subtitle: `${asset.assetType} · ${asset.category}`,
    category: "asset",
    assetType: asset.assetType,
    assetUrl: asset.url,
    previewUrl: pickAssetPreviewUrl(asset),
    serialized: `Reference (${asset.assetType}) "${asset.title}": ${asset.url}`,
  }
}
