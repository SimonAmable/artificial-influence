import {

  BRAND_COLOR_ROLES,

  type BrandColorRole,

  type BrandColorToken,

  type BrandReferenceMediaItem,

  type BrandTypography,

} from "./types"



function normalizeHex(raw: string): string | null {

  const s = raw.trim()

  if (!s) return null

  const withHash = s.startsWith("#") ? s : `#${s}`

  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) return null

  return withHash.toUpperCase()

}



export function parseColorTokens(input: unknown): BrandColorToken[] {

  if (!Array.isArray(input)) return []

  const out: BrandColorToken[] = []

  for (const item of input) {

    if (!item || typeof item !== "object") continue

    const o = item as Record<string, unknown>

    const hex = typeof o.hex === "string" ? normalizeHex(o.hex) : null

    if (!hex) continue

    const role = typeof o.role === "string" && BRAND_COLOR_ROLES.includes(o.role as BrandColorRole)

      ? (o.role as BrandColorRole)

      : "other"

    const label = typeof o.label === "string" ? o.label.trim() || undefined : undefined

    out.push({ hex, role, label })

  }

  return out

}



export function parseTypography(input: unknown): BrandTypography {

  if (!input || typeof input !== "object" || Array.isArray(input)) return {}

  const o = input as Record<string, unknown>

  return {

    headingFont: typeof o.headingFont === "string" ? o.headingFont.trim() || undefined : undefined,

    bodyFont: typeof o.bodyFont === "string" ? o.bodyFont.trim() || undefined : undefined,

    monoFont: typeof o.monoFont === "string" ? o.monoFont.trim() || undefined : undefined,

    notes: typeof o.notes === "string" ? o.notes.trim() || undefined : undefined,

  }

}



export function parseStringArray(input: unknown): string[] {

  if (!Array.isArray(input)) return []

  return input

    .filter((x): x is string => typeof x === "string")

    .map((s) => s.trim())

    .filter(Boolean)

}



export function parseReferenceMedia(input: unknown): BrandReferenceMediaItem[] {

  if (!Array.isArray(input)) return []

  const out: BrandReferenceMediaItem[] = []

  for (const item of input) {

    if (!item || typeof item !== "object") continue

    const o = item as Record<string, unknown>

    const url = typeof o.url === "string" ? o.url.trim() : ""

    if (!url) continue

    const kind = o.kind === "video" ? "video" : "image"

    out.push({ url, kind })

  }

  return out

}



/** Split UI `referenceMedia` into two URL lists for DB columns. */

export function splitReferenceMediaToColumns(

  media: BrandReferenceMediaItem[],

): { reference_images: string[]; reference_videos: string[] } {

  const reference_images: string[] = []

  const reference_videos: string[] = []

  for (const m of media) {

    if (m.kind === "video") reference_videos.push(m.url)

    else reference_images.push(m.url)

  }

  return { reference_images, reference_videos }

}

