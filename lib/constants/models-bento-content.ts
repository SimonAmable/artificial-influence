import type { LandingBentoCardMedia } from "@/lib/types/landing"

/** Base URL for bento card backgrounds: files live in `public/ai_icons/AI_MATERIALS_SHOWCASES/`. */
export const AI_MATERIALS_SHOWCASES_DIR = "/ai_icons/AI_MATERIALS_SHOWCASES" as const

function showcase(file: string): string {
  return `${AI_MATERIALS_SHOWCASES_DIR}/${file}`
}

/** Marketing copy for the models bento block (homepage). */
export const modelsBentoCopy = {
  eyebrow: "One plan · full stack",
  title: "One subscription. Your whole model stack.",
  description:
    "20+ models in one membership: single plan, no vendor hopscotch. Stay on the edge of what's new without chasing separate licenses.",
  primaryCtaLabel: "Get started free",
  primaryCtaHref: "/login?mode=signup",
  secondaryCtaLabel: "View pricing",
  secondaryCtaHref: "/pricing",
} as const

/** Curated homepage cards so the landing page shows actual supported model names, not backend/provider buckets. */
export const modelsBentoFeaturedIdentifiers = [
  "google/nano-banana-2",
  "openai/gpt-image-2",
  "xai/grok-imagine-image",
  "bytedance/seedream-5-lite",
  "google/veo-3.1-fast",
  "bytedance/seedance-2.0",
  "alibaba/happy-horse",
  "kwaivgi/kling-v3-motion-control",
] as const

/**
 * One background per vendor slug (identifier prefix before `/`).
 * Filenames in `AI_MATERIALS_SHOWCASES` match the brand/model line each card showcases.
 */
export const modelsBentoShowcaseByVendorSlug: Record<string, LandingBentoCardMedia> = {
  /** Google / Gemini (file: `gemeni.jpeg`) */
  google: { mediaType: "image", src: showcase("gemeni.jpeg") },
  /** OpenAI / ChatGPT */
  openai: { mediaType: "image", src: showcase("chatgpt.jpeg") },
  bytedance: { mediaType: "image", src: showcase("bytedance.jpeg") },
  /** Kling: `kwaivgi` in model identifiers */
  kwaivgi: { mediaType: "image", src: showcase("KLING.jpeg") },
  /** xAI / Grok */
  xai: { mediaType: "image", src: showcase("grok.jpeg") },
  minimax: { mediaType: "image", src: showcase("minimax.jpeg") },
  veed: { mediaType: "image", src: showcase("veed.jpeg") },
  alibaba: { mediaType: "image", src: showcase("alibaba.png") },
  /** Pruna / FLUX & related */
  prunaai: { mediaType: "image", src: showcase("generated-image-1776347735470.jpeg") },
}

/** When a vendor has no matching showcase file mapping. */
export const modelsBentoFallbackMedia: LandingBentoCardMedia = {
  mediaType: "image",
  src: showcase("showcase-01.png"),
}

/** Optional fixed background per vendor slug (overrides `modelsBentoShowcaseByVendorSlug`). */
export const modelsBentoVendorMediaOverrides: Partial<
  Record<string, LandingBentoCardMedia>
> = {}
