import type { CarouselShotsModelId } from "@/lib/carousel-shots/types"

export const CAROUSEL_SHOTS_TOOL = "carousel_shots" as const

/** History list page size for infinite scroll. */
export const CAROUSEL_SHOTS_HISTORY_PAGE_LIMIT = 3

export const DEFAULT_CAROUSEL_SHOTS_MODEL: CarouselShotsModelId = "google/nano-banana-2"

export const CAROUSEL_SHOTS_MODELS: ReadonlyArray<{
  id: CarouselShotsModelId
  label: string
}> = [
  { id: "google/nano-banana-2", label: "Nano Banana 2" },
  { id: "google/nano-banana-2-lite", label: "Nano Banana 2 Lite" },
  { id: "openai/gpt-image-2", label: "GPT Image 2" },
  { id: "xai/grok-imagine-image-2.0", label: "Grok Image 2" },
  { id: "bytedance/seedream-4.5", label: "Seedream 4.5" },
  { id: "bytedance/seedream-5-lite", label: "Seedream 5.0 Lite" },
  { id: "bytedance/seedream-5-pro", label: "Seedream 5.0 Pro" },
]

export const CAROUSEL_GENERATION_MODES = ["fast", "hd"] as const

export const CAROUSEL_GRID_SIZES = [4, 9] as const

export const CAROUSEL_HD_SHOT_COUNT_MIN = 1
export const CAROUSEL_HD_SHOT_COUNT_MAX = 12
export const DEFAULT_CAROUSEL_HD_SHOT_COUNT = 4

export const CAROUSEL_PANEL_ASPECT_RATIOS = ["9:16", "4:5", "3:4"] as const

export const CAROUSEL_VARIATION_STRENGTHS = ["subtle", "natural", "creative", "custom"] as const

export const CAROUSEL_UPSCALE_SETTINGS_STORAGE_KEY = "carousel-shots-upscale-settings"

export const CAROUSEL_SHOTS_EXAMPLE = {
  slideUrls: [
    "/carousel-shots-slides/slide-01.png",
    "/carousel-shots-slides/slide-02.png",
    "/carousel-shots-slides/slide-03.png",
    "/carousel-shots-slides/slide-04.png",
  ],
  /** Native example slide ratio (~378x666). */
  aspectRatioClass: "aspect-[9/16]",
  title: "Carousel Shots",
  description:
    "Upload one photo to create a full carousel of matching shots for the cost of one image.",
} as const

export function getCarouselReferencePublicUrl(storagePath: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  const path = storagePath.trim().replace(/^\/+/, "")
  if (!base || !path) return null
  return `${base}/storage/v1/object/public/public-bucket/${path}`
}

export function isCarouselShotsModelId(value: string): value is CarouselShotsModelId {
  return CAROUSEL_SHOTS_MODELS.some((model) => model.id === value)
}

export function isCarouselHdShotCount(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= CAROUSEL_HD_SHOT_COUNT_MIN &&
    value <= CAROUSEL_HD_SHOT_COUNT_MAX
  )
}

/** Deep-link into Carousel Shots with a reference image prefilled. */
export function carouselShotsHrefFromImage(imageUrl: string): string {
  return `/carousel-shots?image=${encodeURIComponent(imageUrl)}`
}
