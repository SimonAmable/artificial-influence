import "server-only"

import { isNanoBananaFamilyModel } from "@/lib/server/nano-banana-family"
import { scrubNanoBananaSynthId } from "@/lib/server/scrub-nano-banana-synth-id"
import { stripImageMetadataServer } from "@/lib/server/strip-image-metadata"

const DEFAULT_MIME_TYPE = "image/png"

async function resolveSourceImage({
  buffer,
  mimeType,
  remoteUrl,
}: {
  buffer?: Buffer
  mimeType?: string
  remoteUrl?: string
}): Promise<{ buffer: Buffer; mimeType: string; remoteUrl?: string }> {
  if (buffer) {
    return {
      buffer,
      mimeType: mimeType ?? DEFAULT_MIME_TYPE,
      remoteUrl,
    }
  }

  if (!remoteUrl) {
    throw new Error("Generated image source must include a buffer or remote URL.")
  }

  const response = await fetch(remoteUrl)
  if (!response.ok) {
    throw new Error(`Failed to download generated image (${response.status}).`)
  }

  const resolvedMimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ||
    mimeType ||
    DEFAULT_MIME_TYPE

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: resolvedMimeType,
    remoteUrl,
  }
}

export async function prepareGeneratedImageForStorage({
  autoStrip,
  buffer,
  mimeType,
  modelIdentifier,
  remoteUrl,
}: {
  autoStrip: boolean
  buffer?: Buffer
  mimeType?: string
  modelIdentifier: string
  remoteUrl?: string
}): Promise<{ buffer: Buffer; mimeType: string }> {
  const source = await resolveSourceImage({ buffer, mimeType, remoteUrl })

  if (!autoStrip) {
    return {
      buffer: source.buffer,
      mimeType: source.mimeType,
    }
  }

  let workingBuffer = source.buffer
  let workingMimeType = source.mimeType

  if (isNanoBananaFamilyModel(modelIdentifier)) {
    const scrubbed = await scrubNanoBananaSynthId({
      buffer: workingBuffer,
      mimeType: workingMimeType,
      remoteUrl: source.remoteUrl,
    })

    if (scrubbed) {
      workingBuffer = scrubbed.buffer
      workingMimeType = scrubbed.mimeType
    }
  }

  return stripImageMetadataServer(workingBuffer, workingMimeType)
}
