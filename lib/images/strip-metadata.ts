"use client"

const DEFAULT_EXPORT_TYPE = "image/png"
const SUPPORTED_EXPORT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
])

const UNSUPPORTED_INPUT_TYPES = new Set([
  "image/gif",
  "image/svg+xml",
])

export type StripMetadataInput = File | Blob | string

export interface StripMetadataOptions {
  fileName?: string
  mimeType?: string
  quality?: number
}

export interface StrippedImageResult {
  blob: Blob
  mimeType: string
  fileName: string
  width: number
  height: number
  originalSizeBytes?: number
}

export class StripMetadataError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "unsupported-type"
      | "fetch-failed"
      | "decode-failed"
      | "export-failed"
      | "browser-unsupported",
  ) {
    super(message)
    this.name = "StripMetadataError"
  }
}

function getInputMimeType(input: StripMetadataInput, options?: StripMetadataOptions) {
  if (options?.mimeType) return options.mimeType
  if (typeof input !== "string" && input.type) return input.type
  return DEFAULT_EXPORT_TYPE
}

function getInputFileName(input: StripMetadataInput, options?: StripMetadataOptions) {
  if (options?.fileName) return options.fileName
  if (input instanceof File && input.name) return input.name
  if (typeof input === "string") {
    try {
      const pathname = new URL(input).pathname
      const fromUrl = pathname.split("/").filter(Boolean).pop()
      if (fromUrl) return decodeURIComponent(fromUrl)
    } catch {
      // Fall through to default.
    }
  }
  return `image-${Date.now()}.png`
}

function getOutputMimeType(inputMimeType: string) {
  const normalized = inputMimeType.split(";")[0]?.trim().toLowerCase()
  if (normalized && SUPPORTED_EXPORT_TYPES.has(normalized)) return normalized
  return DEFAULT_EXPORT_TYPE
}

function getExtension(mimeType: string) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg"
    case "image/webp":
      return "webp"
    case "image/avif":
      return "avif"
    default:
      return "png"
  }
}

export function createMetadataFreeFileName(fileName: string, mimeType: string) {
  const extension = getExtension(mimeType)
  const base = fileName
    .replace(/[?#].*$/, "")
    .replace(/\.[a-zA-Z0-9]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "image"

  return `${base}-metadata-free.${extension}`
}

async function inputToBlob(input: StripMetadataInput) {
  if (typeof input !== "string") return input

  let response: Response
  try {
    response = await fetch(input)
  } catch {
    throw new StripMetadataError("Could not fetch this image.", "fetch-failed")
  }

  if (!response.ok) {
    throw new StripMetadataError("Could not fetch this image.", "fetch-failed")
  }

  return response.blob()
}

async function loadImageFromBlob(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob)

  try {
    const image = new Image()
    image.decoding = "async"
    image.src = objectUrl
    await image.decode()

    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("Decoded image has no dimensions")
    }

    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
    }
  } catch {
    throw new StripMetadataError("This image could not be decoded.", "decode-failed")
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new StripMetadataError("Could not export a clean image.", "export-failed"))
          return
        }
        resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}

export async function stripImageMetadata(
  input: StripMetadataInput,
  options?: StripMetadataOptions,
): Promise<StrippedImageResult> {
  if (typeof document === "undefined") {
    throw new StripMetadataError("Metadata removal only runs in the browser.", "browser-unsupported")
  }

  const inputMimeType = getInputMimeType(input, options)
  const normalizedInputMimeType = inputMimeType.split(";")[0]?.trim().toLowerCase()

  if (!normalizedInputMimeType.startsWith("image/")) {
    throw new StripMetadataError("Please choose an image file.", "unsupported-type")
  }

  if (UNSUPPORTED_INPUT_TYPES.has(normalizedInputMimeType)) {
    throw new StripMetadataError("Animated and SVG images are not supported yet.", "unsupported-type")
  }

  const sourceBlob = await inputToBlob(input)
  const sourceMimeType = (sourceBlob.type || inputMimeType).split(";")[0]?.trim().toLowerCase()
  if (sourceMimeType && UNSUPPORTED_INPUT_TYPES.has(sourceMimeType)) {
    throw new StripMetadataError("Animated and SVG images are not supported yet.", "unsupported-type")
  }

  const resolvedMimeType = getOutputMimeType(sourceBlob.type || inputMimeType)
  const fileName = createMetadataFreeFileName(getInputFileName(input, options), resolvedMimeType)
  const { image, width, height } = await loadImageFromBlob(sourceBlob)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext("2d")
  if (!context) {
    throw new StripMetadataError("Canvas is not available in this browser.", "browser-unsupported")
  }

  context.drawImage(image, 0, 0, width, height)

  const requestedBlob = await canvasToBlob(canvas, resolvedMimeType, options?.quality ?? 0.92)
  const blob =
    requestedBlob.type && requestedBlob.type !== "image/png"
      ? requestedBlob
      : resolvedMimeType === DEFAULT_EXPORT_TYPE
        ? requestedBlob
        : await canvasToBlob(canvas, DEFAULT_EXPORT_TYPE, options?.quality ?? 0.92)
  const outputMimeType = blob.type || DEFAULT_EXPORT_TYPE

  return {
    blob,
    mimeType: outputMimeType,
    fileName: createMetadataFreeFileName(getInputFileName(input, options), outputMimeType),
    width,
    height,
    originalSizeBytes: sourceBlob.size,
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}

export async function stripImageMetadataAndDownload(
  input: StripMetadataInput,
  options?: StripMetadataOptions,
) {
  const result = await stripImageMetadata(input, options)
  downloadBlob(result.blob, result.fileName)
  return result
}
