/** Above this count, image slides are bundled into one .zip (one save dialog). */
export const REFERENCE_SLIDES_ZIP_THRESHOLD = 3

function inferExtensionFromUrl(url: string, fallback: "jpg") {
  const lower = url.toLowerCase()
  if (lower.includes(".png")) return "png"
  if (lower.includes(".webp")) return "webp"
  if (lower.includes(".jpeg") || lower.includes(".jpg")) return "jpg"
  return fallback
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement("a")
    anchor.href = objectUrl
    anchor.download = filename
    anchor.rel = "noopener"
    anchor.style.display = "none"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url, { mode: "cors", cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`)
  }
  return response.blob()
}

/**
 * Download image slide URLs: up to `REFERENCE_SLIDES_ZIP_THRESHOLD` files as separate downloads;
 * beyond that, one ZIP `{baseName}-slides.zip` with `slide-01.ext` … inside.
 */
export async function downloadReferenceImageSlides(urls: string[], baseName: string): Promise<void> {
  if (urls.length === 0) {
    return
  }

  if (urls.length > REFERENCE_SLIDES_ZIP_THRESHOLD) {
    const { default: JSZip } = await import("jszip")
    const zip = new JSZip()
    for (let i = 0; i < urls.length; i += 1) {
      const blob = await fetchBlob(urls[i])
      const ext = inferExtensionFromUrl(urls[i], "jpg")
      const n = (i + 1).toString().padStart(2, "0")
      zip.file(`slide-${n}.${ext}`, blob)
    }
    const zipBlob = await zip.generateAsync({ type: "blob" })
    triggerBlobDownload(zipBlob, `${baseName}-slides.zip`)
    return
  }

  for (let index = 0; index < urls.length; index += 1) {
    const slideUrl = urls[index]
    const extension = inferExtensionFromUrl(slideUrl, "jpg")
    const blob = await fetchBlob(slideUrl)
    triggerBlobDownload(blob, `${baseName}-slide-${index + 1}.${extension}`)
    if (index < urls.length - 1) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 280)
      })
    }
  }
}
