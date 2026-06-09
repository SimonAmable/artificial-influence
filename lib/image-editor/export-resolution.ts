import type { Canvas as FabricCanvas, FabricObject } from "fabric"

/** Keep browser memory sane on very large source images. */
const MAX_EXPORT_EDGE_PX = 8192

type BaseImageObject = FabricObject & {
  type: string
  name?: string
  layerId?: string
  width?: number
  height?: number
  scaleX?: number
  scaleY?: number
}

type MaskOverlayObject = FabricObject & {
  id?: string
  name?: string
  __isMaskOverlay?: boolean
}

function isFabricBitmapImage(obj: FabricObject): obj is BaseImageObject {
  return obj.type === "Image" || obj.type === "image"
}

function isMaskOverlay(obj: FabricObject): boolean {
  const overlay = obj as MaskOverlayObject
  return (
    overlay.__isMaskOverlay === true ||
    overlay.id === "mask-overlay" ||
    overlay.name === "Mask"
  )
}

export function getBitmapImageIntrinsicSize(image: BaseImageObject): {
  width: number
  height: number
} {
  const width = image.width ?? 0
  const height = image.height ?? 0
  if (width > 0 && height > 0) {
    return { width, height }
  }

  const maybeGetElement = image as BaseImageObject & {
    getElement?: () => HTMLImageElement | undefined
  }
  const el =
    typeof maybeGetElement.getElement === "function"
      ? maybeGetElement.getElement()
      : (image as unknown as { _element?: HTMLImageElement })._element

  if (el && el.naturalWidth > 0 && el.naturalHeight > 0) {
    return { width: el.naturalWidth, height: el.naturalHeight }
  }

  return { width: 0, height: 0 }
}

export function getPrimaryImageObject(canvas: FabricCanvas): BaseImageObject | null {
  const objects = canvas.getObjects() as BaseImageObject[]
  const baseImage =
    objects.find(
      (obj) =>
        isFabricBitmapImage(obj) &&
        (obj.name === "Background Image" || obj.layerId === "base")
    ) || objects.find((obj) => isFabricBitmapImage(obj))

  return baseImage ?? null
}

/**
 * The editor canvas is sized to the viewport; export should match the base image's
 * native pixel density so text and overlays stay sharp.
 */
export function getCanvasExportMultiplier(canvas: FabricCanvas): number {
  const baseImage = getPrimaryImageObject(canvas)
  if (!baseImage) return 1

  const intrinsic = getBitmapImageIntrinsicSize(baseImage)
  const displayedWidth = (baseImage.width ?? 0) * (baseImage.scaleX ?? 1)
  const displayedHeight = (baseImage.height ?? 0) * (baseImage.scaleY ?? 1)

  if (
    displayedWidth <= 0 ||
    displayedHeight <= 0 ||
    intrinsic.width <= 0 ||
    intrinsic.height <= 0
  ) {
    return 1
  }

  let multiplier = Math.min(
    intrinsic.width / displayedWidth,
    intrinsic.height / displayedHeight
  )
  multiplier = Math.max(1, multiplier)

  const canvasWidth = canvas.width ?? 0
  const canvasHeight = canvas.height ?? 0
  if (canvasWidth > 0 && canvasHeight > 0) {
    const exportWidth = canvasWidth * multiplier
    const exportHeight = canvasHeight * multiplier
    const maxEdge = Math.max(exportWidth, exportHeight)
    if (maxEdge > MAX_EXPORT_EDGE_PX) {
      multiplier *= MAX_EXPORT_EDGE_PX / maxEdge
    }
  }

  return multiplier
}

export function withHiddenExportArtifacts<T>(
  canvas: FabricCanvas,
  fn: () => T
): T {
  const hidden: Array<{ obj: FabricObject; wasVisible: boolean }> = []

  for (const obj of canvas.getObjects()) {
    if (!isMaskOverlay(obj)) continue
    hidden.push({ obj, wasVisible: obj.visible !== false })
    obj.set("visible", false)
    obj.dirty = true
  }

  if (hidden.length > 0) {
    canvas.requestRenderAll()
  }

  try {
    return fn()
  } finally {
    for (const { obj, wasVisible } of hidden) {
      obj.set("visible", wasVisible)
      obj.dirty = true
    }
    if (hidden.length > 0) {
      canvas.requestRenderAll()
    }
  }
}
