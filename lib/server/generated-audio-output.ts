import "server-only"

type ResponseLike = {
  arrayBuffer?: () => Promise<ArrayBuffer>
  blob?: () => Promise<Blob>
  headers?: { get?: (name: string) => string | null }
  url?: string | (() => string)
  toString?: () => string
}

function extractUrl(value: unknown): string | null {
  if (typeof value === "string" && /^https?:\/\//.test(value)) return value
  if (Array.isArray(value) && value.length > 0) return extractUrl(value[0])
  if (!value || typeof value !== "object") return null

  const candidate = value as ResponseLike & {
    audio?: { url?: string }
    file?: { url?: string }
  }
  if (typeof candidate.audio?.url === "string") return candidate.audio.url
  if (typeof candidate.file?.url === "string") return candidate.file.url
  if (typeof candidate.url === "function") return candidate.url()
  if (typeof candidate.url === "string") return candidate.url

  const text = candidate.toString?.()
  return typeof text === "string" && /^https?:\/\//.test(text) ? text : null
}

function normalizeMimeType(contentType?: string | null) {
  const value = (contentType ?? "").toLowerCase()
  if (value.includes("wav")) return "audio/wav" as const
  if (value.includes("ogg") || value.includes("opus")) return "audio/ogg" as const
  if (value.includes("pcm")) return "audio/pcm" as const
  return "audio/mpeg" as const
}

export function getAudioFileExtension(mimeType: string) {
  if (mimeType === "audio/wav") return "wav"
  if (mimeType === "audio/ogg") return "ogg"
  if (mimeType === "audio/pcm") return "pcm"
  return "mp3"
}

export async function readGeneratedAudio(output: unknown) {
  const resolved = Array.isArray(output) && output.length > 0 ? output[0] : output
  const responseLike = resolved as ResponseLike | null

  if (responseLike && typeof responseLike.arrayBuffer === "function") {
    const mimeType = normalizeMimeType(responseLike.headers?.get?.("content-type"))
    return {
      audioBuffer: Buffer.from(await responseLike.arrayBuffer()),
      mimeType,
      fileExtension: getAudioFileExtension(mimeType),
    }
  }

  if (responseLike && typeof responseLike.blob === "function") {
    const blob = await responseLike.blob()
    const mimeType = normalizeMimeType(blob.type)
    return {
      audioBuffer: Buffer.from(await blob.arrayBuffer()),
      mimeType,
      fileExtension: getAudioFileExtension(mimeType),
    }
  }

  const url = extractUrl(resolved)
  if (!url) {
    throw new Error("The audio provider returned an unsupported output.")
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download generated audio (${response.status}).`)
  }

  const mimeType = normalizeMimeType(response.headers.get("content-type"))
  return {
    audioBuffer: Buffer.from(await response.arrayBuffer()),
    mimeType,
    fileExtension: getAudioFileExtension(mimeType),
  }
}
