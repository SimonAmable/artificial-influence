import "server-only"

import sharp from "sharp"

const DEFAULT_MIME_TYPE = "image/png"

function normalizeMimeType(mimeType: string | undefined): string {
  const normalized = mimeType?.split(";")[0]?.trim().toLowerCase()
  if (!normalized || !normalized.startsWith("image/")) {
    return DEFAULT_MIME_TYPE
  }
  return normalized
}

export async function stripImageMetadataServer(
  buffer: Buffer,
  mimeType?: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const inputMimeType = normalizeMimeType(mimeType)

  try {
    const image = sharp(buffer, { failOn: "none" }).rotate()

    let outputBuffer: Buffer
    let outputMimeType = inputMimeType

    switch (inputMimeType) {
      case "image/jpeg":
        outputBuffer = await image.jpeg({ quality: 92, mozjpeg: true }).toBuffer()
        break
      case "image/webp":
        outputBuffer = await image.webp({ quality: 92 }).toBuffer()
        break
      case "image/avif":
        outputBuffer = await image.avif({ quality: 80 }).toBuffer()
        break
      case "image/png":
      default:
        outputBuffer = await image.png().toBuffer()
        outputMimeType = "image/png"
        break
    }

    return { buffer: outputBuffer, mimeType: outputMimeType }
  } catch (error) {
    console.error("[strip-image-metadata] Failed to strip metadata; using original buffer", error)
    return { buffer, mimeType: inputMimeType }
  }
}
