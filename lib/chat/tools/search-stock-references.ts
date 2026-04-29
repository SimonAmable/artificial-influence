import { tool } from "ai"
import { z } from "zod"
import { searchStockReferences } from "@/lib/stock/search"

export function createSearchStockReferencesTool() {
  return tool({
    description:
      "Search external stock/reference media providers. Use this when you need meme, reaction GIF, sticker, or future stock media references before generating. Start here instead of assuming a provider; the system can route meme/reaction searches to GIPHY.",
    inputSchema: z.object({
      query: z.string().min(2).max(80).describe("Exact user search terms. Do not rewrite meme/GIF search text."),
      intent: z
        .string()
        .max(80)
        .optional()
        .describe("Optional intent hint such as meme, reaction, sticker, product photo, or stock video."),
      provider: z
        .enum(["auto", "giphy"])
        .optional()
        .describe("Preferred stock provider. Use auto unless the user explicitly names the source."),
      mediaType: z
        .enum(["all", "gif", "sticker", "image", "video", "audio"])
        .optional()
        .describe("Preferred media type. For GIPHY-backed searches, gif and sticker are the supported v1 values."),
      rating: z.enum(["g", "pg", "pg-13", "r"]).optional(),
      lang: z.string().max(8).optional(),
      limit: z.number().int().min(1).max(24).optional(),
      offset: z.number().int().min(0).max(4999).optional(),
    }),
    strict: true,
    execute: async ({ intent, lang, limit, mediaType, offset, provider, query, rating }) => {
      return searchStockReferences({
        intent,
        lang,
        limit,
        mediaType,
        offset,
        provider,
        query,
        rating,
      })
    },
  })
}
