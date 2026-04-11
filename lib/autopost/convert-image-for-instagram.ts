/**
 * Instagram Content Publishing feed photos expect JPEG (not PNG/WebP/GIF).
 * Converts in-browser before upload; transparent areas become white.
 */
const JPEG_QUALITY = 0.92
/** Avoid huge canvases; Instagram has practical limits; this keeps memory sane. */
const MAX_EDGE_PX = 8192

export async function ensureJpegForInstagramFeed(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file
  }
  if (file.type === "image/jpeg" || file.type === "image/jpg") {
    return file
  }

  let bitmap: ImageBitmap | undefined
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error("Could not read this image. Try JPEG or PNG.")
  }

  try {
    let w = bitmap.width
    let h = bitmap.height
    if (w > MAX_EDGE_PX || h > MAX_EDGE_PX) {
      const scale = MAX_EDGE_PX / Math.max(w, h)
      w = Math.round(w * scale)
      h = Math.round(h * scale)
    }

    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      throw new Error("Could not prepare image for upload.")
    }

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not encode JPEG."))),
        "image/jpeg",
        JPEG_QUALITY
      )
    })

    const stem = file.name.replace(/\.[^./\\]+$/i, "").trim() || "post"
    return new File([blob], `${stem}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    })
  } finally {
    bitmap?.close()
  }
}
