import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import type { AudioProvider } from "@/lib/constants/audio"
import { searchCatalogVoices } from "@/lib/server/audio-voices"

interface CreateSearchVoicesToolOptions {
  supabase: SupabaseClient
}

const voiceSourceSchema = z.enum(["SYSTEM", "IVC", "PVC"])

export function createSearchVoicesTool({ supabase }: CreateSearchVoicesToolOptions) {
  return tool({
    description:
      "Search UniCan's voice catalog for chat audio generation. Use this before generateAudio when the user asks for a voice by qualities like warm, gravelly, breezy, youthful, narrator, sad, or best Gemini/Inworld voice. Results include preview metadata and exact voice ids.",
    inputSchema: z.object({
      query: z
        .string()
        .max(120)
        .optional()
        .describe("Optional descriptive search such as warm female gemini narrator or sad inworld monologue voice."),
      provider: z
        .enum(["inworld", "google"])
        .optional()
        .describe("Optional provider filter."),
      languageCodes: z
        .array(z.string().min(2).max(32))
        .max(8)
        .optional()
        .describe("Optional language filter such as en-US."),
      source: voiceSourceSchema
        .optional()
        .describe("Optional voice source filter: built-in SYSTEM, clone IVC, or pro clone PVC."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(12)
        .optional()
        .describe("Maximum number of voices to return."),
    }),
    strict: true,
    execute: async ({
      languageCodes = [],
      limit = 6,
      provider,
      query,
      source,
    }: {
      languageCodes?: string[]
      limit?: number
      provider?: AudioProvider
      query?: string
      source?: "SYSTEM" | "IVC" | "PVC"
    }) => {
      const voices = await searchCatalogVoices(supabase, {
        languages: languageCodes,
        limit,
        provider,
        query,
        source,
      })

      return {
        message:
          voices.length > 0
            ? `Found ${voices.length} voice${voices.length === 1 ? "" : "s"}${provider ? ` for ${provider}` : ""}.`
            : "No voices matched that search.",
        provider: provider ?? null,
        query: query ?? null,
        source: source ?? null,
        total: voices.length,
        voices: voices.map((voice) => ({
          description: voice.description,
          displayName: voice.displayName,
          langCode: voice.langCode,
          model: voice.model ?? null,
          previewAudioUrl: voice.previewAudioUrl ?? null,
          previewText: voice.previewText ?? null,
          provider: voice.provider ?? null,
          source: voice.source,
          tags: voice.tags,
          voiceId: voice.voiceId,
        })),
      }
    },
  })
}
