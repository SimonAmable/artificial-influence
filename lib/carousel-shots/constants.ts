import type { CarouselShotsModelId } from "@/lib/carousel-shots/types"

export const CAROUSEL_SHOTS_TOOL = "carousel_shots" as const

export const DEFAULT_CAROUSEL_SHOTS_MODEL: CarouselShotsModelId = "google/nano-banana-2"

export const CAROUSEL_SHOTS_MODELS: ReadonlyArray<{
  id: CarouselShotsModelId
  label: string
}> = [
  { id: "google/nano-banana-2", label: "Nano Banana 2" },
  { id: "openai/gpt-image-2", label: "GPT Image 2" },
  { id: "bytedance/seedream-5-pro", label: "Seedream 5.0 Pro" },
]

export const CAROUSEL_GRID_SIZES = [4, 9] as const

export const CAROUSEL_PANEL_ASPECT_RATIOS = ["3:4", "4:5", "9:16"] as const

export const CAROUSEL_VARIATION_STRENGTHS = ["subtle", "natural", "creative"] as const

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
    "Upload one photo to create a full carousel of matching shots for the cost of one image.  Download or upscale any panel.",
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
