import type { ModelMetadata } from "@/lib/constants/model-metadata"
import type { ModelType } from "@/lib/types/models"
import type { LandingBentoCardMedia } from "@/lib/types/landing"
import {
  modelsBentoFallbackMedia,
  modelsBentoShowcaseByVendorSlug,
  modelsBentoVendorMediaOverrides,
} from "@/lib/constants/models-bento-content"

const VENDOR_LABELS: Record<string, string> = {
  google: "Google",
  openai: "OpenAI",
  bytedance: "ByteDance",
  kwaivgi: "Kling",
  minimax: "MiniMax",
  veed: "Veed",
  prunaai: "Pruna",
  qwen: "Qwen",
  xai: "Grok",
  alibaba: "Alibaba",
  "fal-ai": "Wan",
}

export interface VendorModelGroup {
  vendorSlug: string
  displayName: string
  models: ModelMetadata[]
}

export function vendorSlugFromIdentifier(identifier: string): string | null {
  const i = identifier.indexOf("/")
  if (i <= 0) return null
  return identifier.slice(0, i).toLowerCase()
}

export function vendorDisplayName(slug: string): string {
  if (VENDOR_LABELS[slug]) return VENDOR_LABELS[slug]
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/** Background media for a vendor tile, uses named files in `AI_MATERIALS_SHOWCASES` per slug. */
export function pickBentoCardMedia(vendorSlug: string): LandingBentoCardMedia {
  const override = modelsBentoVendorMediaOverrides[vendorSlug]
  if (override) return override

  const slug = vendorSlug.toLowerCase()
  const mapped = modelsBentoShowcaseByVendorSlug[slug]
  if (mapped) return mapped

  return modelsBentoFallbackMedia
}

export function groupModelsByVendor(models: ModelMetadata[]): VendorModelGroup[] {
  const map = new Map<string, ModelMetadata[]>()

  for (const m of models) {
    const slug = vendorSlugFromIdentifier(m.identifier)
    if (!slug) continue
    const list = map.get(slug)
    if (list) list.push(m)
    else map.set(slug, [m])
  }

  const groups: VendorModelGroup[] = []
  for (const [vendorSlug, list] of map.entries()) {
    list.sort((a, b) => a.name.localeCompare(b.name))
    groups.push({
      vendorSlug,
      displayName: vendorDisplayName(vendorSlug),
      models: list,
    })
  }

  groups.sort((a, b) => {
    const dc = b.models.length - a.models.length
    if (dc !== 0) return dc
    return a.displayName.localeCompare(b.displayName)
  })

  return groups
}

/** Short list of model names for Magic UI BentoCard description line. */
export function summarizeVendorModels(models: ModelMetadata[], maxNames = 4): string {
  if (models.length === 0) return ""
  const names = models.slice(0, maxNames).map((m) => m.name)
  const suffix = models.length > maxNames ? " …" : ""
  return names.join(" · ") + suffix
}

/** One-line teaser for bento cards (no long paragraphs). */
export function compactModelTeaser(description: string | undefined, maxLen = 72): string {
  if (!description?.trim()) return ""
  const t = description.replace(/\s+/g, " ").trim()
  if (t.length <= maxLen) return t
  const cut = t.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(" ")
  const base = lastSpace > 40 ? cut.slice(0, lastSpace) : cut
  return `${base.trim()}…`
}

export function modelHrefForLanding(type: ModelType, identifier: string): string {
  const q = encodeURIComponent(identifier)
  switch (type) {
    case "image":
      return `/image?model=${q}`
    case "video":
      return `/video?model=${q}`
    case "audio":
    case "upscale":
    default:
      return "/pricing"
  }
}
