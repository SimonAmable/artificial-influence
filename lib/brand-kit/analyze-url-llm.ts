import { createGateway, generateObject, zodSchema } from "ai"

import { brandOnboardingObjectSchema, type BrandOnboardingObject } from "@/lib/brand-kit/onboarding-schema"
import type { PageExtraction } from "@/lib/brand-kit/analyze-html"
import { BRAND_COLOR_ROLES, type BrandColorToken } from "@/lib/brand-kit/types"

const ONBOARDING_MODEL = "google/gemini-2.5-flash" as const

function gatewayModel() {
  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY is not set")
  }
  return createGateway({ apiKey })(ONBOARDING_MODEL)
}

function sanitizeLogoChoice(
  selected: string | null | undefined,
  candidates: string[],
): string | null {
  if (!selected?.trim()) return null
  const t = selected.trim()
  return candidates.includes(t) ? t : null
}

/**
 * Map LLM hex suggestions to simple color tokens (best-effort).
 */
function normalizeHex6(h: string): string | null {
  let s = h.trim()
  if (!s.startsWith("#")) s = `#${s}`
  if (/^#[0-9A-Fa-f]{6}$/i.test(s)) return s.toUpperCase()
  if (/^#[0-9A-Fa-f]{3}$/i.test(s)) {
    const r = s[1]!
    const g = s[2]!
    const b = s[3]!
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  return null
}

/** Map LLM hex suggestions to color tokens (roles follow extraction order). */
export function mapSuggestedColorsToTokens(hexes: string[]): BrandColorToken[] {
  const out: BrandColorToken[] = []
  for (let i = 0; i < hexes.length && i < BRAND_COLOR_ROLES.length; i++) {
    const normalized = normalizeHex6(hexes[i] ?? "")
    if (!normalized) continue
    out.push({ hex: normalized, role: BRAND_COLOR_ROLES[i]! })
  }
  return out
}

export async function draftBrandFromPage(
  extraction: PageExtraction,
  finalUrl: string,
  logoCandidates: string[],
): Promise<BrandOnboardingObject> {
  const candidateBlock = logoCandidates.length
    ? logoCandidates.map((u, i) => `${i + 1}. ${u}`).join("\n")
    : "(none — leave selectedLogoUrl null)"

  const themeLine = extraction.themeColorHint
    ? `HTML meta theme-color (use as a strong hint; expand to a full palette): ${extraction.themeColorHint}`
    : "(no meta theme-color)"

  const cssColorsBlock =
    extraction.extractedColorCandidates?.length
      ? extraction.extractedColorCandidates.join(", ")
      : "(none — infer palette from title, description, and visible text only)"

  const prompt = `You are helping fill a brand kit from a public web page. Infer concrete, usable values for a design system.

Final URL (canonical): ${finalUrl}

Page title: ${extraction.title ?? "(unknown)"}
Meta description: ${extraction.description ?? "(unknown)"}
${themeLine}

Design-token and inline-style color candidates (from CSS variables like --primary / --brand and short inline styles — NOT an exhaustive dump of every color on the page). Prefer these #RRGGBB values when they clearly match the brand; otherwise infer from copy and theme-color:
${cssColorsBlock}

Logo / image candidates (you MUST NOT invent URLs — only pick selectedLogoUrl from this list or null):
${candidateBlock}

Visible text (truncated):
${extraction.visibleText}

Rules:
- suggestedColors: Return 4–8 distinct hex colors as #RRGGBB (primary, secondary, accent, background, surface, text, other). **Prioritize** colors from the candidate list when they fit the brand; if the list is empty or generic, infer a cohesive palette from the page title, description, visible text, and theme-color. Avoid unrelated saturated hues unless the copy clearly indicates that aesthetic.
- suggestedFontFamily / suggestedMonoFont: Guess from page context (marketing sites often name fonts in CSS or headings). Use common web font names or generic families (e.g. "Inter", "system-ui") if unknown.
- avoidWords, audience, layoutNotes: Fill when inferable from copy; otherwise use empty array or null.
- selectedLogoUrl: copy exactly one string from the candidates list above, or null if none fit.
- notes: optional short synthesis only; do not include implementation plans or step lists.`

  const { object } = await generateObject({
    model: gatewayModel(),
    schema: zodSchema(brandOnboardingObjectSchema),
    prompt,
    temperature: 0.3,
  })

  let suggestedColors = [...(object.suggestedColors ?? [])]
  if (suggestedColors.length === 0 && extraction.extractedColorCandidates?.length) {
    suggestedColors = extraction.extractedColorCandidates.slice(0, BRAND_COLOR_ROLES.length)
  } else if (suggestedColors.length === 0 && extraction.themeColorHint) {
    const h = normalizeHex6(extraction.themeColorHint)
    if (h) suggestedColors = [h]
  }

  const sanitized: BrandOnboardingObject = {
    ...object,
    suggestedColors,
    selectedLogoUrl: sanitizeLogoChoice(object.selectedLogoUrl, logoCandidates),
    websiteUrl: object.websiteUrl?.trim() || finalUrl,
    warnings: [...(object.warnings ?? [])],
  }

  return sanitized
}
