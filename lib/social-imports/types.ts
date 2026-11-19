export type SocialPlatform =
  | "tiktok"
  | "instagram"
  | "threads"
  | "youtube_shorts"
  | "x"
  | "reddit"
  | "facebook"
  | "pinterest"
  | "redgifs"
  | "direct"

export type SocialMediaKind = "image" | "video" | "animated"

export type SocialMediaItem = {
  index: number
  kind: SocialMediaKind
  remoteUrl: string
  previewUrl: string | null
  width: number | null
  height: number | null
  durationSeconds: number | null
}

export type SocialImportManifest = {
  platform: SocialPlatform
  canonicalUrl: string
  sourceTitle: string | null
  media: SocialMediaItem[]
  expiresAt: string
}

export interface SocialImportAdapter {
  platform: SocialPlatform
  matches(url: URL): boolean
  inspect(url: URL): Promise<SocialImportManifest>
}

export const SOCIAL_MEDIA_IMPORTS_TABLE = "social_media_imports" as const

/** @deprecated Use SOCIAL_MEDIA_IMPORTS_TABLE */
export const SOCIAL_REFERENCE_DOWNLOAD_JOB_TABLE = SOCIAL_MEDIA_IMPORTS_TABLE

export const MANIFEST_TTL_MS = 30 * 60 * 1000

export function buildManifestExpiryIso(fromMs = Date.now()): string {
  return new Date(fromMs + MANIFEST_TTL_MS).toISOString()
}