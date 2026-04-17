/**
 * Backend routes use full Fal / Replicate endpoint ids; the product catalog should
 * only show unified model identifiers (one row per product in the UI).
 */

export function isHiddenCatalogModelIdentifier(identifier: string): boolean {
  if (identifier.startsWith("fal-ai/qwen-image-2/")) return true
  if (identifier.startsWith("wan-video/wan-2.7-")) return true
  return false
}

export function filterPublicCatalogModels<T extends { identifier: string }>(models: T[]): T[] {
  const out: T[] = []
  const seen = new Set<string>()
  for (const m of models) {
    if (isHiddenCatalogModelIdentifier(m.identifier)) continue
    if (seen.has(m.identifier)) continue
    seen.add(m.identifier)
    out.push(m)
  }
  return out
}
