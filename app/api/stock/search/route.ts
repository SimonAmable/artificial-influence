import { NextRequest, NextResponse } from "next/server"
import { searchStockReferences } from "@/lib/stock/search"
import type {
  SearchStockReferencesInput,
  StockReferenceMediaType,
  StockReferenceProvider,
  StockReferenceRating,
} from "@/lib/stock/types"

function clampNumber(raw: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = (searchParams.get("query") || "").trim()

  if (!query) {
    return NextResponse.json({ error: "Query is required." }, { status: 400 })
  }

  try {
    const result = await searchStockReferences({
      query,
      intent: searchParams.get("intent") || undefined,
      provider: (searchParams.get("provider") as StockReferenceProvider | "auto" | null) ?? undefined,
      mediaType: (searchParams.get("mediaType") as StockReferenceMediaType | "all" | null) ?? undefined,
      rating: (searchParams.get("rating") as StockReferenceRating | null) ?? undefined,
      lang: searchParams.get("lang") || undefined,
      limit: clampNumber(searchParams.get("limit"), 18, 1, 24),
      offset: clampNumber(searchParams.get("offset"), 0, 0, 4999),
    } satisfies SearchStockReferencesInput)

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stock search failed."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
