import type { SlideshowOverlay } from "@/lib/slideshows/types"

/** Matches `tiktok-original` in lib/video-editor/text-style-presets.ts */
export const TIKTOK_ORIGINAL_OVERLAY = {
  fill: "#ffffff",
  stroke: "#000000",
  baseFontSize: 72,
  baseStrokeWidth: 6,
  fontWeight: 800,
  fontFamily: '"TikTok Sans", "Montserrat", "Inter", Arial, sans-serif',
  textShadow: "0 2px 0 rgba(0,0,0,0.95), 0 5px 14px rgba(0,0,0,0.45)",
} as const

export const SLIDESHOW_RENDER_WIDTH = 1080

export const SLIDESHOW_OVERLAY_STYLE_LABELS: Record<SlideshowOverlay["style"], string> = {
  minimal: "Original",
  clean: "Box",
  caption: "Caption",
  impact: "Impact",
}

export const SLIDESHOW_OVERLAY_STYLE_DESCRIPTIONS: Record<SlideshowOverlay["style"], string> = {
  minimal: "Default stroke text — no background box",
  clean: "White rounded caption box",
  caption: "Dark semi-transparent box",
  impact: "Bold text on light box",
}

/** Project-editor overlay styles (Original vs Box only). */
export const PROJECT_OVERLAY_STYLES = ["minimal", "clean"] as const satisfies readonly SlideshowOverlay["style"][]

export function previewFontSize(renderFontSize: number, previewWidth: number) {
  const scaled = Math.round(renderFontSize * (previewWidth / SLIDESHOW_RENDER_WIDTH))
  return Math.max(10, Math.min(scaled, renderFontSize))
}

export function strokeWidthForFontSize(fontSize: number) {
  return Math.max(2, Math.round((fontSize / TIKTOK_ORIGINAL_OVERLAY.baseFontSize) * TIKTOK_ORIGINAL_OVERLAY.baseStrokeWidth))
}

export function overlayBaseFontSize(
  style: SlideshowOverlay["style"],
  fontSizeSetting: "normal" | "small" = "normal",
) {
  const base = style === "impact" ? 72 : 54
  const scaled = fontSizeSetting === "small" ? Math.round(base * 0.82) : base
  return scaled
}

export function tiktokStrokeTextStyle(fontSizePx: number) {
  const strokeWidth = strokeWidthForFontSize(fontSizePx)
  return {
    color: TIKTOK_ORIGINAL_OVERLAY.fill,
    fontFamily: TIKTOK_ORIGINAL_OVERLAY.fontFamily,
    fontWeight: TIKTOK_ORIGINAL_OVERLAY.fontWeight,
    WebkitTextStroke: `${strokeWidth}px ${TIKTOK_ORIGINAL_OVERLAY.stroke}`,
    paintOrder: "stroke fill" as const,
    textShadow: TIKTOK_ORIGINAL_OVERLAY.textShadow,
    fontSize: fontSizePx,
    lineHeight: 1.15,
  }
}

export function overlayPreviewTypography(
  style: SlideshowOverlay["style"],
  options?: {
    fontSizeSetting?: "normal" | "small"
    previewWidth?: number
  },
): { className: string; style?: Record<string, string | number> } {
  const fontSizeSetting = options?.fontSizeSetting ?? "normal"
  const previewWidth = options?.previewWidth ?? 280
  const renderFontSize = overlayBaseFontSize(style, fontSizeSetting)
  const fontSize = previewFontSize(renderFontSize, previewWidth)
  const wrapClass = "max-w-[92%] text-center leading-tight break-words [overflow-wrap:anywhere]"

  if (style === "minimal") {
    return {
      className: wrapClass,
      style: tiktokStrokeTextStyle(fontSize),
    }
  }

  if (style === "caption") {
    return {
      className: `${wrapClass} rounded-2xl bg-black/75 px-3 py-2 font-bold text-white`,
      style: { fontSize: Math.round(fontSize * 0.92) },
    }
  }

  if (style === "impact") {
    return {
      className: `${wrapClass} rounded-2xl bg-white/92 px-3 py-2 font-extrabold text-[#090909] shadow-sm`,
      style: { fontSize },
    }
  }

  return {
    className: `${wrapClass} rounded-2xl bg-white/92 px-3 py-2 font-bold text-[#090909] shadow-sm`,
    style: { fontSize: Math.round(fontSize * 0.92) },
  }
}

export function overlaySvgFontSize(style: SlideshowOverlay["style"]) {
  return style === "impact" ? 72 : 54
}

export function overlaySvgLineHeight(style: SlideshowOverlay["style"]) {
  return style === "impact" ? 88 : 68
}

export function renderOverlaySvgLines(input: {
  style: SlideshowOverlay["style"]
  lines: string[]
  x: number
  baseY: number
  lineHeight: number
  fontSize: number
}) {
  const { style, lines, x, baseY, lineHeight, fontSize } = input

  if (style === "minimal") {
    const strokeWidth = strokeWidthForFontSize(fontSize)
    return lines.map((line, index) =>
      `<text x="${x}" y="${baseY + fontSize + index * lineHeight}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="800" fill="${TIKTOK_ORIGINAL_OVERLAY.fill}" stroke="${TIKTOK_ORIGINAL_OVERLAY.stroke}" stroke-width="${strokeWidth}" paint-order="stroke fill" stroke-linejoin="round">${line}</text>`,
    ).join("")
  }

  const color = style === "caption" ? "#fff" : "#090909"
  return lines.map((line, index) =>
    `<text x="${x}" y="${baseY + fontSize + index * lineHeight}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="800" fill="${color}">${line}</text>`,
  ).join("")
}

export function overlaySvgBackground(
  style: SlideshowOverlay["style"],
  blockHeight: number,
  baseY: number,
  width: number,
) {
  if (style === "minimal") return ""
  const padding = 32
  const background = style === "caption"
    ? "rgba(0,0,0,.76)"
    : "rgba(255,255,255,.92)"
  return `<rect x="70" y="${baseY - padding}" width="${width - 140}" height="${blockHeight + padding * 2}" rx="24" fill="${background}"/>`
}

export function applyTextDefaultsToOverlays<T extends { overlays: SlideshowOverlay[] }>(
  slide: T,
  defaultStyle: SlideshowOverlay["style"],
): T {
  return {
    ...slide,
    overlays: slide.overlays.map((overlay) => ({
      ...overlay,
      style: overlay.style ?? defaultStyle,
    })),
  }
}
