/**
 * Google Fonts API helpers (see https://github.com/thevinodpatidar/shadcn-font-picker).
 * Requires NEXT_PUBLIC_GOOGLE_FONTS_API_KEY in .env.local
 */

export interface GoogleFont {
  family: string
  variants: string[]
  subsets: string[]
  version: string
  lastModified: string
  files: Record<string, string>
  category: string
  kind: string
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_FONTS_API_KEY
const API_URL = "https://www.googleapis.com/webfonts/v1/webfonts"

const loadedFonts = new Set<string>()

let fontsCache: GoogleFont[] | null = null
let fontsCacheTimestamp: number | null = null
const CACHE_DURATION = 24 * 60 * 60 * 1000

export async function fetchGoogleFonts(): Promise<GoogleFont[]> {
  if (fontsCache && fontsCacheTimestamp && Date.now() - fontsCacheTimestamp < CACHE_DURATION) {
    return fontsCache
  }

  if (!API_KEY) {
    throw new Error("NEXT_PUBLIC_GOOGLE_FONTS_API_KEY is not set")
  }

  const response = await fetch(`${API_URL}?key=${API_KEY}&sort=popularity`)
  if (!response.ok) {
    throw new Error("Failed to fetch Google Fonts")
  }
  const data = (await response.json()) as { items: GoogleFont[] }
  fontsCache = data.items
  fontsCacheTimestamp = Date.now()
  return data.items
}

export function getFontStylesheetUrl(fontFamily: string, variant = "regular"): string {
  const family = fontFamily.replace(/\s+/g, "+")
  const w = variant === "regular" ? "400" : variant
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${w}&display=swap`
}

export async function loadFont(fontFamily: string, variant = "regular"): Promise<void> {
  if (loadedFonts.has(fontFamily)) return

  return new Promise((resolve, reject) => {
    const link = document.createElement("link")
    link.href = getFontStylesheetUrl(fontFamily, variant)
    link.rel = "stylesheet"
    link.onload = () => {
      loadedFonts.add(fontFamily)
      resolve()
    }
    link.onerror = () => reject(new Error(`Failed to load font: ${fontFamily}`))
    document.head.appendChild(link)
  })
}
