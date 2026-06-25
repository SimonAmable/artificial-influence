import type { Canvas as FabricCanvas } from "fabric"
import { uploadBlobToSupabase } from "@/lib/canvas/upload-helpers"
import {
  getCanvasExportMultiplier,
  withHiddenExportArtifacts,
} from "@/lib/image-editor/export-resolution"

/**
 * Export canvas to data URL
 */
export function canvasToDataUrl(
  canvas: FabricCanvas,
  format: "png" | "jpeg" = "png",
  quality: number = 1,
  multiplier?: number
): string {
  return withHiddenExportArtifacts(canvas, () =>
    canvas.toDataURL({
      format,
      quality,
      multiplier: multiplier ?? getCanvasExportMultiplier(canvas),
    })
  )
}

/**
 * Export canvas to Blob
 */
export async function canvasToBlob(
  canvas: FabricCanvas,
  format: "png" | "jpeg" = "png",
  quality: number = 1,
  multiplier?: number
): Promise<Blob> {
  const dataUrl = canvasToDataUrl(canvas, format, quality, multiplier)
  const response = await fetch(dataUrl)
  return response.blob()
}

/** Flatten the canvas at native resolution so crop preserves image quality.
 *  Always uses multiplier=1 — crop must operate on the exact pixels the canvas
 *  holds, not a display-scaled or memory-capped version. */
export async function exportCanvasForCrop(
  canvas: FabricCanvas,
  format: "png" | "jpeg" = "png"
): Promise<Blob> {
  return canvasToBlob(canvas, format, 1, 1)
}

/**
 * Download canvas as image file
 */
export function downloadCanvas(
  canvas: FabricCanvas,
  filename: string = "edited-image",
  format: "png" | "jpeg" = "png"
): void {
  const dataUrl = canvasToDataUrl(canvas, format)
  const link = document.createElement("a")
  link.download = `${filename}.${format}`
  link.href = dataUrl
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Upload edited canvas to Supabase and return URL
 */
export async function uploadEditedImage(
  canvas: FabricCanvas,
  format: "png" | "jpeg" = "png"
): Promise<string | null> {
  try {
    const blob = await canvasToBlob(canvas, format)
    const filename = `edited-${Date.now()}.${format}`

    const result = await uploadBlobToSupabase(blob, filename, "edited-images")

    if (result) {
      return result.url
    }
    return null
  } catch (error) {
    console.error("Failed to upload edited image:", error)
    return null
  }
}
