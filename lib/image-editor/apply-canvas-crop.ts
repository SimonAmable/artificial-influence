import type { Canvas as FabricCanvas } from "fabric"
import { getCroppedImg, type CroppedAreaPixels } from "@/lib/utils/crop-image"
import { clampCroppedAreaPixels } from "@/lib/image-editor/crop-pixel-utils"
import {
  getThemeWorkspaceBackgroundColor,
  loadImageOntoCanvas,
} from "@/lib/image-editor/fabric-utils"
import { serializeCanvas } from "@/lib/image-editor/history-manager"

/**
 * Apply a pixel crop to the editor canvas and push the result onto history.
 * Expects `sourceImageUrl` to be a flattened export of the current canvas.
 */
export async function applyCanvasCrop(
  canvas: FabricCanvas,
  sourceImageUrl: string,
  croppedAreaPixels: CroppedAreaPixels
): Promise<{ url: string; serialized: string } | null> {
  try {
    const probe = await loadImageDimensions(sourceImageUrl)
    const safeCrop = clampCroppedAreaPixels(
      croppedAreaPixels,
      probe.width,
      probe.height
    )
    const croppedBlob = await getCroppedImg(sourceImageUrl, safeCrop)
    const croppedUrl = URL.createObjectURL(croppedBlob)

    canvas.clear()
    canvas.set({ backgroundColor: getThemeWorkspaceBackgroundColor() })
    await loadImageOntoCanvas(canvas, croppedUrl)

    const serialized = serializeCanvas(canvas)
    return { url: croppedUrl, serialized }
  } catch (error) {
    console.error("Failed to apply canvas crop:", error)
    return null
  }
}

function loadImageDimensions(
  url: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener("load", () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    })
    image.addEventListener("error", (error) => reject(error))
    image.setAttribute("crossOrigin", "anonymous")
    image.src = url
  })
}
