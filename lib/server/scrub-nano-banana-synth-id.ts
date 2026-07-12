import "server-only"

import Replicate from "replicate"

const FLUX_2_KLEIN_9B_MODEL = "black-forest-labs/flux-2-klein-9b"
const SCRUB_PROMPT = "change nothing"

function extractOutputUrl(output: unknown): string | null {
  if (typeof output === "string") return output

  if (output && typeof output === "object") {
    const candidate = output as { url?: string | (() => string) }

    if (typeof candidate.url === "function") {
      return candidate.url()
    }

    if (typeof candidate.url === "string") {
      return candidate.url
    }
  }

  if (Array.isArray(output)) {
    for (const item of output) {
      const url = extractOutputUrl(item)
      if (url) return url
    }
  }

  return null
}

function bufferToDataUri(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`
}

export async function scrubNanoBananaSynthId({
  buffer,
  mimeType = "image/png",
  remoteUrl,
}: {
  buffer?: Buffer
  mimeType?: string
  remoteUrl?: string
}): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error("[scrub-nano-banana-synth-id] REPLICATE_API_TOKEN is not configured")
    return null
  }

  const imageInput =
    remoteUrl ??
    (buffer ? bufferToDataUri(buffer, mimeType) : null)

  if (!imageInput) {
    console.error("[scrub-nano-banana-synth-id] No image source available for scrub")
    return null
  }

  try {
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    })

    const output = await replicate.run(FLUX_2_KLEIN_9B_MODEL as `${string}/${string}`, {
      input: {
        prompt: SCRUB_PROMPT,
        images: [imageInput],
        aspect_ratio: "match_input_image",
        go_fast: true,
        output_format: "png",
        disable_safety_checker: true,
      },
      wait: { mode: "poll", interval: 2000 },
    })

    const scrubbedUrl = extractOutputUrl(output)
    if (!scrubbedUrl) {
      console.error("[scrub-nano-banana-synth-id] Flux 2 Klein 9B returned no output URL")
      return null
    }

    const response = await fetch(scrubbedUrl)
    if (!response.ok) {
      console.error(
        "[scrub-nano-banana-synth-id] Failed to download scrubbed image",
        response.status,
      )
      return null
    }

    const scrubbedMimeType =
      response.headers.get("content-type")?.split(";")[0]?.trim() || mimeType
    const scrubbedBuffer = Buffer.from(await response.arrayBuffer())

    return {
      buffer: scrubbedBuffer,
      mimeType: scrubbedMimeType,
    }
  } catch (error) {
    console.error("[scrub-nano-banana-synth-id] Flux scrub failed; continuing with strip-only", error)
    return null
  }
}
