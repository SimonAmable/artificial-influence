import { mapSuggestedColorsToTokens } from "@/lib/brand-kit/analyze-url-llm"
import type { BrandOnboardingClientPayload } from "@/lib/brand-kit/onboarding-schema"
import { normalizeMinimalBrandColors } from "@/lib/brand-kit/normalize-minimal-colors"
import type { BrandReferenceMediaItem } from "@/lib/brand-kit/types"

function normalizeHex(raw: string): string {
  const s = raw.trim().replace(/^#/, "")
  if (s.length === 6 && /^[0-9A-Fa-f]{6}$/.test(s)) return `#${s.toUpperCase()}`
  return raw.startsWith("#") ? raw : `#${raw}`
}

/** Body for `POST /api/brand-kits` after `/api/brand-kit/analyze-url` succeeds. */
export function buildBrandKitPostBodyFromAnalyzePayload(
  payload: BrandOnboardingClientPayload,
): Record<string, unknown> {
  const { draft } = payload
  const name = draft.suggestedName?.trim() || "My brand"
  const tagline = draft.tagline?.trim() || null
  const brandValues = draft.brandValues ?? []
  const aestheticTags = draft.aestheticTags ?? []
  const toneTags = draft.toneTags ?? []
  const fontFamily = draft.suggestedFontFamily?.trim() || ""
  const monoFont = draft.suggestedMonoFont?.trim()
  const avoidWords = draft.avoidWords ?? []
  const audience = draft.audience?.trim() || null
  const layoutNotes = draft.layoutNotes?.trim() || null

  const noteParts: string[] = []
  if (draft.notes?.trim()) noteParts.push(draft.notes.trim())
  if (payload.themeColorHint) {
    noteParts.push(`Detected meta theme-color: ${payload.themeColorHint}`)
  }
  if (draft.warnings?.length) {
    noteParts.push(`Warnings: ${draft.warnings.join("; ")}`)
  }
  const notes = noteParts.length ? noteParts.join("\n\n") : null

  const websiteUrl =
    (draft.websiteUrl?.trim() || payload.finalUrl || "").trim() || null
  const logoUrl = draft.selectedLogoUrl || null

  const colorTokens = normalizeMinimalBrandColors(
    mapSuggestedColorsToTokens(draft.suggestedColors ?? []),
  ).map((c) => ({ ...c, hex: normalizeHex(c.hex) }))

  const extractedImages = payload.referenceImages ?? []
  const extractedVideos = payload.referenceVideos ?? []
  const skipUrls = new Set<string>()
  if (draft.selectedLogoUrl) skipUrls.add(draft.selectedLogoUrl)
  const referenceMedia: BrandReferenceMediaItem[] = [
    ...extractedImages
      .filter((u) => !skipUrls.has(u))
      .map((url) => ({ url, kind: "image" as const })),
    ...extractedVideos.map((url) => ({ url, kind: "video" as const })),
  ]

  const typography = {
    bodyFont: fontFamily || undefined,
    headingFont: fontFamily || undefined,
    monoFont: monoFont || undefined,
    notes: undefined,
  }

  return {
    name,
    isDefault: false,
    websiteUrl,
    fontFamily: fontFamily || null,
    referenceMedia,
    brandValues,
    aestheticTags,
    toneTags,
    notes,
    logoUrl,
    logoDarkUrl: null,
    iconUrl: null,
    iconDarkUrl: null,
    colors: colorTokens,
    typography,
    tagline,
    avoidWords,
    layoutNotes,
    audience,
  }
}
