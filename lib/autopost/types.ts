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

export type TikTokPublishOptions = {
  mode?: "upload" | "direct"
  privacyLevel?: string
  disableComment?: boolean
  disableDuet?: boolean
  disableStitch?: boolean
  isAigc?: boolean
  brandOrganicToggle?: boolean
  brandContentToggle?: boolean
  creatorInfo?: {
    privacyLevelOptions?: string[]
    commentDisabled?: boolean
    duetDisabled?: boolean
    stitchDisabled?: boolean
    maxVideoPostDurationSec?: number
  }
  publishId?: string
  uploadUrl?: string | null
  status?: string
  failReason?: string | null
  statusFetchedAt?: string
}

export type AutopostJobMetadata = {
  carouselItems?: AutopostCarouselItem[]
  /** Required when media_type is story. */
  assetKind?: "image" | "video"
  publishOptions?: AutopostPublishOptions
  tiktok?: TikTokPublishOptions
}

export type AutopostMediaType =
  | "image"
  | "reel"
  | "feed_video"
  | "carousel"
  | "story"
  | "tiktok_video_upload"
  | "tiktok_video_direct"
