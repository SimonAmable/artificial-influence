import { buildGenerationHistoryDeepLink } from "@/lib/library/generation-history-path"
import { getCurrentProductSiteUrl } from "@/lib/product/current"

export function getMcpAppSiteUrl() {
  return getCurrentProductSiteUrl()
}

export function buildGenerationPageUrl(generationId: string) {
  return buildGenerationHistoryDeepLink(generationId, getCurrentProductSiteUrl())
}

export function buildCharacterPageUrl(characterAssetId: string) {
  const params = new URLSearchParams({
    tab: "characters",
    character: characterAssetId,
  })
  return `${getCurrentProductSiteUrl()}/assets?${params.toString()}`
}

export function buildAssetPageUrl(assetId: string, category?: string | null) {
  if (category === "character") {
    return buildCharacterPageUrl(assetId)
  }

  const params = new URLSearchParams({ tab: "assets" })
  return `${getCurrentProductSiteUrl()}/assets?${params.toString()}`
}
