import { listAssets } from "@/lib/assets/library"
import type { AssetRecord } from "@/lib/assets/types"
import type { BrandKit } from "@/lib/brand-kit/types"

let assetsCache: AssetRecord[] | null = null
let brandKitsCache: BrandKit[] | null = null
let assetsPromise: Promise<AssetRecord[]> | null = null
let brandKitsPromise: Promise<BrandKit[]> | null = null

export function invalidateCommandCache(): void {
  assetsCache = null
  brandKitsCache = null
  assetsPromise = null
  brandKitsPromise = null
}

async function fetchBrandKits(): Promise<BrandKit[]> {
  const res = await fetch("/api/brand-kits")
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(j.error || "Failed to load brand kits")
  }
  const data = (await res.json()) as { kits?: BrandKit[] }
  return data.kits ?? []
}

/** Brand kits are small — prefetch on mount so @ palette is ready. */
export async function getCachedBrandKits(): Promise<BrandKit[]> {
  if (brandKitsCache) return brandKitsCache
  if (!brandKitsPromise) {
    brandKitsPromise = fetchBrandKits().then((kits) => {
      brandKitsCache = kits
      return kits
    })
  }
  return brandKitsPromise
}

export function prefetchBrandKits(): void {
  void getCachedBrandKits().catch(() => {})
}

/** Assets may be large — lazy on first @. */
export async function getCachedAssets(): Promise<AssetRecord[]> {
  if (assetsCache) return assetsCache
  if (!assetsPromise) {
    assetsPromise = listAssets({}).then((assets) => {
      assetsCache = assets
      return assets
    })
  }
  return assetsPromise
}
