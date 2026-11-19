import {
  assertContentLengthAllowed,
  assertHttpsPublicUrl,
  fetchHttpsWithRedirectGuard,
  isAllowedDirectMediaHostname,
  sniffMediaKindFromContentType,
} from "../security"
import type { SocialImportAdapter, SocialImportManifest, SocialMediaItem } from "../types"
import { buildManifestExpiryIso } from "../types"

function directMediaKind(
  url: URL,
  contentType: string | null,
): "image" | "video" | "animated" {
  const sniffed = sniffMediaKindFromContentType(contentType)
  if (sniffed) return sniffed
  const path = url.pathname.toLowerCase()
  if (path.endsWith(".gif")) return "animated"
  if (/\.(mp4|webm|mov)(\?|$)/i.test(path)) return "video"
  if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(path)) return "image"
  throw new Error("This direct URL is not a supported image, video, or GIF file.")
}

export const directSocialImportAdapter: SocialImportAdapter = {
  platform: "direct",
  matches(url) {
    if (!isAllowedDirectMediaHostname(url.hostname)) {
      const path = url.pathname.toLowerCase()
      return /\.(gif|mp4|webm|mov|jpg|jpeg|png|webp)(\?|$)/i.test(path)
    }
    return true
  },
  async inspect(url) {
    const canonicalUrl = assertHttpsPublicUrl(url.href).href
    const parsed = new URL(canonicalUrl)
    if (!isAllowedDirectMediaHostname(parsed.hostname)) {
      const path = parsed.pathname.toLowerCase()
      if (!/\.(gif|mp4|webm|mov|jpg|jpeg|png|webp)(\?|$)/i.test(path)) {
        throw new Error("Direct URLs must point to a public image, video, or GIF file.")
      }
    }

    const head = await fetchHttpsWithRedirectGuard(canonicalUrl, { method: "HEAD" })
    if (!head.ok && head.status !== 405) {
      throw new Error("Could not access that media URL.")
    }
    assertContentLengthAllowed(head.headers.get("content-length"))

    const kind = directMediaKind(parsed, head.headers.get("content-type"))

    const media: SocialMediaItem[] = [
      {
        index: 0,
        kind,
        remoteUrl: canonicalUrl,
        previewUrl: kind === "image" ? canonicalUrl : null,
        width: null,
        height: null,
        durationSeconds: null,
      },
    ]

    return {
      platform: "direct",
      canonicalUrl,
      sourceTitle: null,
      media,
      expiresAt: buildManifestExpiryIso(),
    }
  },
}