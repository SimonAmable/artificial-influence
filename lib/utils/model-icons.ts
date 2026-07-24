import { AI_VENDOR_ICON_BY_SLUG } from "@/lib/constants/ai-vendor-icons"
import { productLogo } from "@/lib/product/branding"

/**
 * Maps model identifiers to their corresponding icon paths in public/ai_icons
 */
export function getModelIconPath(identifier: string): string | null {
  if (identifier === 'custom/character-swap' || identifier === 'custom/face-swap') {
    return productLogo
  }

  // Flux models hosted under non-BFL prefixes still use the Flux mark
  if (
    identifier === 'prunaai/flux-kontext-fast' ||
    identifier.startsWith('black-forest-labs/')
  ) {
    return '/ai_icons/flux.svg'
  }

  // Extract the provider/prefix from identifier (e.g., "google/nano-banana" -> "google")
  const prefix = identifier.split('/')[0]?.toLowerCase()
  if (!prefix) return null

  return AI_VENDOR_ICON_BY_SLUG[prefix] ?? null
}
