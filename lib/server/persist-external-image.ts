import "server-only"

import { storeUploadedFileFromServer } from "@/lib/uploads/server"

type PersistedExternalImage = {
  uploadId: string
  url: string
  storagePath: string
  fileName: string
  mimeType: string
}

function inferFileExtension(contentType: string | null, sourceUrl: string) {
  const mime = contentType?.split(";")[0]?.trim().toLowerCase() ?? ""
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  if (mime === "image/gif") return "gif"
  try {
    const pathname = new URL(sourceUrl).pathname.toLowerCase()
    const match = pathname.match(/\.([a-z0-9]{2,10})$/)
    if (match?.[1]) return match[1]
  } catch {
    /* noop */
  }
  return "jpg"
}

export async function persistExternalImage(input: {
  imageUrl: string
  fileNameBase: string
  source?: string
}): Promise<PersistedExternalImage> {
  const response = await fetch(input.imageUrl, {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Failed to download image: HTTP ${response.status}`)
  }

  const contentType = response.headers.get("content-type")
  if (!contentType?.toLowerCase().startsWith("image/")) {
    throw new Error("The imported Pinterest item is not an image.")
  }

  const extension = inferFileExtension(contentType, input.imageUrl)
  const fileName = `${input.fileNameBase}.${extension}`
  const bytes = await response.arrayBuffer()
  const uploaded = await storeUploadedFileFromServer({
    source: input.source ?? "slideshow-collections",
    fileName,
    mimeType: contentType,
    bytes,
  })

  return {
    uploadId: uploaded.uploadId,
    url: uploaded.url,
    storagePath: uploaded.storagePath,
    fileName: uploaded.fileName,
    mimeType: uploaded.mimeType,
  }
}
