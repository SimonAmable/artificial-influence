import { z } from "zod"

/** Structured LLM output for URL → draft brand fields. */
export const brandOnboardingObjectSchema = z.object({
  suggestedName: z.string().describe("Business or product name from the page"),
  tagline: z.string().nullable().optional(),
  brandValues: z.array(z.string()).default([]),
  aestheticTags: z.array(z.string()).default([]),
  toneTags: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  /** 3–8 hex colors (#RRGGBB) mapping brand palette; infer from theme, UI, and imagery */
  suggestedColors: z
    .array(z.string())
    .default([])
    .describe("Hex strings #RRGGBB for primary, secondary, accent, background, text as appropriate"),
  /** Must be exactly one of the provided logo candidate URLs, or null */
  selectedLogoUrl: z.string().nullable().optional(),
  /** Best guess from page fonts / CSS stack names (e.g. Inter, system-ui) */
  suggestedFontFamily: z.string().nullable().optional(),
  suggestedMonoFont: z.string().nullable().optional(),
  avoidWords: z.array(z.string()).default([]).describe("Words or phrases the brand should avoid in copy"),
  audience: z.string().nullable().optional(),
  layoutNotes: z.string().nullable().optional(),
  plan: z
    .object({
      title: z.string(),
      steps: z.array(z.string()),
    })
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
  warnings: z.array(z.string()).default([]),
})

export type BrandOnboardingObject = z.infer<typeof brandOnboardingObjectSchema>

/** API JSON shape returned to the client (includes extraction metadata). */
export type AnalyzeUrlResponse = {
  draft: BrandOnboardingObject
  logoCandidates: string[]
  extractedTitle: string | null
  extractedDescription: string | null
  finalUrl: string
  /** Present when analyze-url extracted meta theme-color */
  themeColorHint?: string | null
  /** Exact #RRGGBB literals scraped from HTML/CSS */
  extractedColorCandidates?: string[]
}

/** Stored in sessionStorage between URL analyze and opening `/brand/[id]` with a fresh kit. */
export type BrandOnboardingClientPayload = AnalyzeUrlResponse

export const BRAND_ONBOARDING_SESSION_KEY = "brandOnboardingDraft" as const
