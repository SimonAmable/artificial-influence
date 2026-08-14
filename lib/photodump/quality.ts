import type { PhotodumpModelId } from "@/lib/photodump/types"
import { getCarouselHdQualityParams } from "@/lib/carousel-shots/quality"

/** Photodump always uses the lowest quality tier per model (same as Carousel HD). */
export function getPhotodumpQualityParams(model: PhotodumpModelId): Record<string, unknown> {
  return getCarouselHdQualityParams(model)
}
