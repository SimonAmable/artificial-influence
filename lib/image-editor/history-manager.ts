import type { Canvas as FabricCanvas } from "fabric"

/**
 * Serializes the current canvas state to JSON string
 */
export function serializeCanvas(canvas: FabricCanvas): string {
  return JSON.stringify(canvas.toJSON(["id", "name", "layerId"]))
}

/**
 * Restores canvas from a JSON string
 */
export async function deserializeCanvas(
  canvas: FabricCanvas,
  state: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const json = JSON.parse(state)
      canvas.loadFromJSON(json).then(() => {
        canvas.renderAll()
        resolve()
      }).catch(reject)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Creates a thumbnail from canvas
 */
export function createThumbnail(
  canvas: FabricCanvas,
  maxWidth: number = 80,
  maxHeight: number = 60
): string {
  const multiplier = Math.min(
    maxWidth / canvas.width!,
    maxHeight / canvas.height!
  )
  return canvas.toDataURL({
    format: "png",
    quality: 0.7,
    multiplier,
  })
}
