const IMAGE_FILENAME_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i
const MARKDOWN_IMAGE_URL_REGEX = /!\[[^\]]*]\((https?:\/\/[^\s)]+)\)/gi
const MARKDOWN_LINK_URL_REGEX = /\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/gi
const RAW_URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi

function normalizeUrlCandidate(url: string): string | null {
  const trimmed = url.trim().replace(/[),.;!?]+$/, "")
  if (!trimmed) return null
  return trimmed
}

function isImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return IMAGE_FILENAME_EXT.test(parsed.pathname)
  } catch {
    return IMAGE_FILENAME_EXT.test(url)
  }
}

export function extractInlineImageUrlsFromText(text: string): string[] {
  const imageUrls = new Set<string>()
  const markdownImageUrls = new Set<string>()

  for (const match of text.matchAll(MARKDOWN_IMAGE_URL_REGEX)) {
    const url = normalizeUrlCandidate(match[1] ?? "")
    if (url) {
      markdownImageUrls.add(url)
    }
  }

  for (const match of text.matchAll(MARKDOWN_LINK_URL_REGEX)) {
    const url = normalizeUrlCandidate(match[1] ?? "")
    if (url && !markdownImageUrls.has(url) && isImageUrl(url)) {
      imageUrls.add(url)
    }
  }

  for (const match of text.matchAll(RAW_URL_REGEX)) {
    const url = normalizeUrlCandidate(match[0] ?? "")
    if (url && !markdownImageUrls.has(url) && isImageUrl(url)) {
      imageUrls.add(url)
    }
  }

  return Array.from(imageUrls)
}

export const CHAT_IMAGE_FILENAME_EXT = IMAGE_FILENAME_EXT
export const CHAT_VIDEO_FILENAME_EXT = /\.(mp4|webm|mov|m4v|mkv)$/i
export const CHAT_AUDIO_FILENAME_EXT = /\.(mp3|wav|ogg|m4a|aac|flac)$/i
