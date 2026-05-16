/** Apify TikTok Scraper enums (clockworks/tiktok-scraper). */

export type TikTokVideoSearchSorting = "MOST_RELEVANT" | "MOST_LIKED" | "LATEST"

export type TikTokVideoSearchDateFilter =
  | "ALL_TIME"
  | "PAST_24_HOURS"
  | "PAST_WEEK"
  | "PAST_MONTH"
  | "LAST_3_MONTHS"
  | "LAST_6_MONTHS"

export type NormalizedTikTokVideoCard = {
  id: string | null
  webVideoUrl: string | null
  /** Best MP4-style URL we can use for playback / reference (may be CDN, may expire). */
  playableVideoUrl: string | null
  /** Slideshow/photo-mode image URLs when available. */
  slideshowImageUrls: string[]
  caption: string | null
  createTimeISO: string | null
  authorUsername: string | null
  authorDisplayName: string | null
  authorProfileUrl: string | null
  coverUrl: string | null
  stats: {
    views: number | null
    likes: number | null
    comments: number | null
    shares: number | null
    saves: number | null
  }
}

export type TikTokReferenceDownloadResult = {
  sourceUrl: string
  /** Stable public URL on your storage when normalization succeeds. */
  outputPublicUrl: string | null
  outputStoragePath: string | null
  normalizationProfile: string | null
  apifyRunId: string | null
  tiktok: NormalizedTikTokVideoCard
}
