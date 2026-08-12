import type { AssetRecord } from "@/lib/assets/types"

export function getCharacterAssetPreviewUrl(asset: Pick<AssetRecord, "url" | "thumbnailUrl">) {
  return asset.thumbnailUrl || asset.url
}
