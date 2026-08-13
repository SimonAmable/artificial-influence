import type { Canvas as FabricCanvas } from "fabric"
import {
  getCanvasExportMultiplier,
  withHiddenExportArtifacts,
} from "@/lib/image-editor/export-resolution"

export type SaveEditedImageOptions = {
  format?: "png" | "jpeg"
  sourceImageUrl?: string | null
  prompt?: string | null
}

export type SaveEditedImageResult = {
  url: string
  generationId: string
}

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

/** Flatten the canvas at native resolution so crop preserves image quality. */
export async function exportCanvasForCrop(
  canvas: FabricCanvas,
  format: "png" | "jpeg" = "png"
): Promise<Blob> {
  return canvasToBlob(canvas, format)
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
 * Save edited canvas as an image_editing generation (history), not an upload.
 */
export async function uploadEditedImage(
  canvas: FabricCanvas,
  options: SaveEditedImageOptions = {}
): Promise<SaveEditedImageResult | null> {
  const format = options.format ?? "png"

  try {
    const blob = await canvasToBlob(canvas, format)
    const formData = new FormData()
    formData.append(
      "image",
      blob,
      `edited-${Date.now()}.${format}`
    )

    if (options.sourceImageUrl?.trim()) {
      formData.append("sourceImageUrl", options.sourceImageUrl.trim())
    }

    if (options.prompt?.trim()) {
      formData.append("prompt", options.prompt.trim())
    }

    const response = await fetch("/api/image-editor/save", {
      method: "POST",
      body: formData,
    })

    const payload = (await response.json().catch(() => null)) as
      | { url?: string; generationId?: string; error?: string }
      | null

    if (!response.ok || !payload?.url || !payload.generationId) {
      console.error(
        "Failed to save edited image:",
        payload?.error ?? response.statusText
      )
      return null
    }

    return {
      url: payload.url,
      generationId: payload.generationId,
    }
  } catch (error) {
    console.error("Failed to save edited image:", error)
    return null
  }
}
