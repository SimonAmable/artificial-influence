/**
 * Stored in autopost_jobs.metadata (jsonb) for non-trivial post types.
 */
export type AutopostCarouselItem = {
  url: string
  kind: "image" | "video"
}

export type AutopostPublishOptions = {
  /** Reels: also show on main feed when true (default true). */
  shareToFeed?: boolean
  coverUrl?: string | null
  trialParams?: {
    graduationStrategy: "MANUAL" | "SS_PERFORMANCE"
  }
}

export type AutopostJobMetadata = {
  carouselItems?: AutopostCarouselItem[]
  /** Required when media_type is story. */
  assetKind?: "image" | "video"
  publishOptions?: AutopostPublishOptions
}

export type AutopostMediaType = "image" | "reel" | "feed_video" | "carousel" | "story"
