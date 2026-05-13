import type { BrandColorToken } from "@/lib/brand-kit/types"

const MINIMAL_DEFAULTS: BrandColorToken[] = [
  { hex: "#3B82F6", role: "primary" },
  { hex: "#FAFAFA", role: "background" },
  { hex: "#171717", role: "text" },
]

/**
 * Collapses any palette to primary / background / text for the simplified brand kit UI.
 * Legacy roles (accent, surface, secondary, …) map into these slots when needed.
 */
export function normalizeMinimalBrandColors(tokens: BrandColorToken[]): BrandColorToken[] {
  const primaryHex =
    tokens.find((t) => t.role === "primary")?.hex ??
    tokens.find((t) => t.role === "accent")?.hex ??
    tokens.find((t) => t.role === "secondary")?.hex ??
    tokens[0]?.hex ??
    MINIMAL_DEFAULTS[0]!.hex

  const backgroundHex =
    tokens.find((t) => t.role === "background")?.hex ??
    tokens.find((t) => t.role === "surface")?.hex ??
    MINIMAL_DEFAULTS[1]!.hex

  const textHex = tokens.find((t) => t.role === "text")?.hex ?? MINIMAL_DEFAULTS[2]!.hex

  const out: BrandColorToken[] = [
    { hex: primaryHex, role: "primary" },
    { hex: backgroundHex, role: "background" },
    { hex: textHex, role: "text" },
  ]
  return out
}
