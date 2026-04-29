import { searchGiphyStockReferences } from "@/lib/stock/providers/giphy"
import type {
  SearchStockReferencesInput,
  SearchStockReferencesResult,
  StockReferenceMediaType,
  StockReferenceProvider,
} from "@/lib/stock/types"

function pickProvider(
  provider: SearchStockReferencesInput["provider"],
  mediaType: SearchStockReferencesInput["mediaType"],
  intent: string | undefined,
): StockReferenceProvider {
  if (provider && provider !== "auto") {
    return provider
  }

  if (mediaType === "gif" || mediaType === "sticker") {
    return "giphy"
  }

  const normalizedIntent = intent?.trim().toLowerCase() ?? ""
  if (
    normalizedIntent.includes("meme") ||
    normalizedIntent.includes("reaction") ||
    normalizedIntent.includes("gif") ||
    normalizedIntent.includes("sticker")
  ) {
    return "giphy"
  }

  return "giphy"
}

function normalizeMediaType(mediaType: SearchStockReferencesInput["mediaType"]): SearchStockReferencesInput["mediaType"] {
  if (mediaType === "gif" || mediaType === "sticker") {
    return mediaType
  }

  return "all"
}

export function getStockProviderOptions() {
  return [{ id: "giphy" as const, label: "GIPHY", mediaTypes: ["gif", "sticker"] as StockReferenceMediaType[] }]
}

export async function searchStockReferences(
  input: SearchStockReferencesInput,
): Promise<SearchStockReferencesResult> {
  const provider = pickProvider(input.provider, input.mediaType, input.intent)
  const mediaType = normalizeMediaType(input.mediaType)

  switch (provider) {
    case "giphy":
      return searchGiphyStockReferences({
        ...input,
        mediaType,
        provider,
      })
    default:
      throw new Error(`Unsupported stock reference provider: ${provider}`)
  }
}
