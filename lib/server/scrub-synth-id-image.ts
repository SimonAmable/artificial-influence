import "server-only"

import sharp from "sharp"

import { scrubNanoBananaSynthId } from "@/lib/server/scrub-nano-banana-synth-id"
import { stripImageMetadataServer } from "@/lib/server/strip-image-metadata"

export type ScrubSynthIdImageResult = {
  buffer: Buffer
  mimeType: string
  width: number
  height: number
}

export async function scrubSynthIdImage(
  buffer: Buffer,
  mimeType: string,
): Promise<ScrubSynthIdImageResult | null> {
  const scrubbed = await scrubNanoBananaSynthId({ buffer, mimeType })
  if (!scrubbed) {
    return null
  }

  const stripped = await stripImageMetadataServer(scrubbed.buffer, scrubbed.mimeType)
  const metadata = await sharp(stripped.buffer, { failOn: "none" }).metadata()

  return {
    buffer: stripped.buffer,
    mimeType: stripped.mimeType,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  }
}
