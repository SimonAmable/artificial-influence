import type { Canvas as FabricCanvas } from "fabric"
import { uploadBlobToSupabase } from "@/lib/canvas/upload-helpers"

/**
 * Export canvas to data URL
 */
export function canvasToDataUrl(
  canvas: FabricCanvas,
  format: "png" | "jpeg" = "png",
  quality: number = 1
): string {
  return canvas.toDataURL({
    format,
    quality,
    multiplier: 1,
  })
}

/**
 * Export canvas to Blob
 */
export async function canvasToBlob(
  canvas: FabricCanvas,
  format: "png" | "jpeg" = "png",
  quality: number = 1
): Promise<Blob> {
  const dataUrl = canvasToDataUrl(canvas, format, quality)
  const response = await fetch(dataUrl)
  return response.blob()
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
