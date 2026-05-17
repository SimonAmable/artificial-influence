/**
 * Fonts available in the image editor text tool. Google entries are bundled into a single
 * Fonts CSS request when the editor loads (see ImageEditorGoogleFontsLink).
 */

export interface ImageEditorFontOption {
  /** Shown as the preview line in the picker */
  label: string
  /** Full CSS stack passed to Fabric `fontFamily` */
  fontFamilyCss: string
}

type GoogleBackedFont = ImageEditorFontOption & {
  /** Google Fonts CSS v2 segment (between `family=` and next `&`) e.g. `Inter:wght@400;700` */
  googleFamilyWeights: string
}

const EDITOR_GOOGLE_FONTS: readonly GoogleBackedFont[] = [
  {
    label: "Inter",
    fontFamilyCss: '"Inter", sans-serif',
    googleFamilyWeights: "Inter:wght@400;600;700",
  },
  {
    label: "Roboto",
    fontFamilyCss: '"Roboto", sans-serif',
    googleFamilyWeights: "Roboto:wght@400;700",
  },
  {
    label: "Open Sans",
    fontFamilyCss: '"Open Sans", sans-serif',
    googleFamilyWeights: "Open+Sans:wght@400;600;700",
  },
  {
    label: "Lato",
    fontFamilyCss: '"Lato", sans-serif',
    googleFamilyWeights: "Lato:wght@400;700",
  },
  {
    label: "Montserrat",
    fontFamilyCss: '"Montserrat", sans-serif',
    googleFamilyWeights: "Montserrat:wght@400;600;700",
  },
  {
    label: "Poppins",
    fontFamilyCss: '"Poppins", sans-serif',
    googleFamilyWeights: "Poppins:wght@400;600;700",
  },
  {
    label: "Nunito",
    fontFamilyCss: '"Nunito", sans-serif',
    googleFamilyWeights: "Nunito:wght@400;600;700",
  },
  {
    label: "Source Sans 3",
    fontFamilyCss: '"Source Sans 3", sans-serif',
    googleFamilyWeights: "Source+Sans+3:wght@400;600;700",
  },
  {
    label: "Merriweather",
    fontFamilyCss: '"Merriweather", serif',
    googleFamilyWeights: "Merriweather:wght@400;700",
  },
  {
    label: "Playfair Display",
    fontFamilyCss: '"Playfair Display", serif',
    googleFamilyWeights: "Playfair+Display:wght@400;700",
  },
  {
    label: "Oswald",
    fontFamilyCss: '"Oswald", sans-serif',
    googleFamilyWeights: "Oswald:wght@400;700",
  },
  {
    label: "Rubik",
    fontFamilyCss: '"Rubik", sans-serif',
    googleFamilyWeights: "Rubik:wght@400;600;700",
  },
  {
    label: "Dancing Script",
    fontFamilyCss: '"Dancing Script", cursive',
    googleFamilyWeights: "Dancing+Script:wght@400;700",
  },
  {
    label: "JetBrains Mono",
    fontFamilyCss: '"JetBrains Mono", monospace',
    googleFamilyWeights: "JetBrains+Mono:wght@400;600",
  },
]

/** System / bundled fallbacks appended after Google faces */
const SYSTEM_EDITOR_FONTS: readonly ImageEditorFontOption[] = [
  {
    label: "Georgia",
    fontFamilyCss: 'Georgia, "Times New Roman", serif',
  },
  {
    label: "Courier New",
    fontFamilyCss: '"Courier New", Courier, monospace',
  },
]

export const IMAGE_EDITOR_GOOGLE_FONT_OPTIONS: readonly ImageEditorFontOption[] =
  EDITOR_GOOGLE_FONTS.map(({ label, fontFamilyCss }) => ({ label, fontFamilyCss }))

export const IMAGE_EDITOR_SYSTEM_FONT_OPTIONS: readonly ImageEditorFontOption[] =
  SYSTEM_EDITOR_FONTS

export const IMAGE_EDITOR_FONT_OPTIONS: readonly ImageEditorFontOption[] = [
  ...IMAGE_EDITOR_GOOGLE_FONT_OPTIONS,
  ...IMAGE_EDITOR_SYSTEM_FONT_OPTIONS,
]

/** First family name / keyword in a stack, for FontFaceSet loading */
export function getPrimaryFontFaceName(fontFamilyCss: string): string {
  const token = fontFamilyCss.split(",")[0].trim()
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    return token.slice(1, -1)
  }
  return token
}

/** Build a CSS `font-family` stack for Fabric from a Google Fonts API record */
export function googleFontToFabricCss(font: { family: string; category: string }): string {
  const escaped = font.family.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  const quoted = `"${escaped}"`
  switch (font.category) {
    case "serif":
      return `${quoted}, serif`
    case "monospace":
      return `${quoted}, monospace`
    case "handwriting":
      return `${quoted}, cursive`
    case "display":
    case "sans-serif":
    default:
      return `${quoted}, sans-serif`
  }
}

/** Match canvas `fontFamily` to a picker row (quotes / spacing tolerant) */
export function canvasFontFamiliesMatch(canvasValue: string, optionCss: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/['"]/g, "")
      .replace(/\s*,\s*/g, ",")
      .replace(/\s+/g, " ")
      .trim()
  return norm(canvasValue) === norm(optionCss)
}

/** Single stylesheet covering all editor Google Fonts with display=swap */
export function getImageEditorGoogleFontsStylesheetHref(): string {
  const parts = EDITOR_GOOGLE_FONTS.map((f) => f.googleFamilyWeights)
  const qs = [`family=${parts[0]}`, ...parts.slice(1).map((p) => `family=${p}`)].join("&")
  return `https://fonts.googleapis.com/css2?${qs}&display=swap`
}
