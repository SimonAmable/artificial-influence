/**
 * Shared helpers for reading Fal queue / webhook image and video outputs.
 */

export function extractFalImageUrls(data: unknown): string[] {
  if (!data || typeof data !== "object") return []

  const record = data as {
    image?: { url?: string } | string
    images?: Array<{ url?: string } | string>
  }

  const urls: string[] = []

  if (Array.isArray(record.images)) {
    for (const image of record.images) {
      if (typeof image === "string" && image.length > 0) {
        urls.push(image)
      } else if (image && typeof image === "object" && typeof image.url === "string" && image.url.length > 0) {
        urls.push(image.url)
      }
    }
  }

  if (urls.length === 0) {
    if (typeof record.image === "string" && record.image.length > 0) {
      urls.push(record.image)
    } else if (
      record.image &&
      typeof record.image === "object" &&
      typeof record.image.url === "string" &&
      record.image.url.length > 0
    ) {
      urls.push(record.image.url)
    }
  }

  return urls
}

export function extractFalVideoUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const video = (data as { video?: { url?: string } | string }).video
  if (typeof video === "string" && video.length > 0) return video
  if (video && typeof video === "object" && typeof video.url === "string" && video.url.length > 0) {
    return video.url
  }
  return null
}

export function isFalRequestNotFoundError(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return (
    normalized === "request not found" ||
    normalized.includes("request not found") ||
    normalized.includes("not found for request")
  )
}
