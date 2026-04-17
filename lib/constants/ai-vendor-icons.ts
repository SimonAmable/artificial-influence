/**
 * Maps model identifier vendor slug (prefix before `/`) to logos in `public/ai_icons/`.
 * File names must match assets in `public/ai_icons/`.
 */
export const DEFAULT_AI_VENDOR_ICON = "/ai_icons/gemini-color.svg" as const

export const AI_VENDOR_ICON_BY_SLUG: Record<string, string> = {
  // Google (Nano Banana, Veo, etc.)
  google: "/ai_icons/gemini-color.svg",
  openai: "/ai_icons/openai.svg",
  bytedance: "/ai_icons/bytedance-color.svg",
  kwaivgi: "/ai_icons/kling-color.svg",
  /** xAI — Grok mark (`grok.svg`), not a generic fallback */
  xai: "/ai_icons/grok.svg",
  prunaai: "/ai_icons/prunaai.svg",
  minimax: "/ai_icons/minimax.svg",
  /** Veed — replace `veed.svg` in `public/ai_icons/` with your brand asset */
  veed: "/ai_icons/veed.svg",
  /** Alibaba / Qwen family models */
  alibaba: "/ai_icons/qwen.svg",
  qwen: "/ai_icons/qwen.svg",
  /** Wan video (Wan 2.x) — Qwen family */
  "wan-video": "/ai_icons/qwen.svg",
}

export function aiVendorIconSrc(vendorSlug: string): string {
  return AI_VENDOR_ICON_BY_SLUG[vendorSlug.toLowerCase()] ?? DEFAULT_AI_VENDOR_ICON
}
