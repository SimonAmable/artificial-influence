import { convertToPixelCrop, type Crop } from "react-image-crop"
import type { CroppedAreaPixels } from "@/lib/utils/crop-image"

export function clampCroppedAreaPixels(
  crop: CroppedAreaPixels,
  imageWidth: number,
  imageHeight: number
): CroppedAreaPixels {
  const x = Math.max(0, Math.min(Math.round(crop.x), imageWidth - 1))
  const y = Math.max(0, Math.min(Math.round(crop.y), imageHeight - 1))
  const width = Math.max(1, Math.min(Math.round(crop.width), imageWidth - x))
  const height = Math.max(1, Math.min(Math.round(crop.height), imageHeight - y))

  return { x, y, width, height }
}

/**
 * Convert a react-image-crop selection to natural-image pixel coordinates.
 * Uses the rendered image dimensions (what the user sees) then scales up.
 */
export function convertCropToNaturalPixels(
  crop: Crop,
  image: HTMLImageElement
): CroppedAreaPixels | null {
  if (!crop.width || !crop.height) return null

  // getBoundingClientRect is reliable even before clientWidth settles; fall
  // back to naturalWidth (1:1 scale) only if the element is truly invisible.
  const rect = image.getBoundingClientRect()
  const displayWidth = rect.width > 0 ? rect.width : image.naturalWidth
  const displayHeight = rect.height > 0 ? rect.height : image.naturalHeight
  const { naturalWidth, naturalHeight } = image

  if (
    displayWidth <= 0 ||
    displayHeight <= 0 ||
    naturalWidth <= 0 ||
    naturalHeight <= 0
  ) {
    return null
  }

  const pixelCrop = convertToPixelCrop(crop, displayWidth, displayHeight)
  const scaleX = naturalWidth / displayWidth
  const scaleY = naturalHeight / displayHeight

  return clampCroppedAreaPixels(
    {
      x: pixelCrop.x * scaleX,
      y: pixelCrop.y * scaleY,
      width: pixelCrop.width * scaleX,
      height: pixelCrop.height * scaleY,
    },
    naturalWidth,
    naturalHeight
  )
}
