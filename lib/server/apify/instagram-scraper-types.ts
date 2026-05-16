/** Normalized subset of items from Apify `apify/instagram-scraper`. */

export type NormalizedInstagramPost = {
  shortCode: string | null
  url: string | null
  type: "Image" | "Video" | "Sidecar" | string | null
  caption: string | null
  /** Thumbnail / first image CDN URL */
  displayUrl: string | null
  /** Direct video URL when `type` is Video or reel */
  videoUrl: string | null
  /** Image URLs only (carousel or single-image posts). excludes `videoUrl` */
  mediaUrls: string[]
  likesCount: number | null
  timestamp: string | null
  ownerUsername: string | null
  ownerFullName: string | null
  /** Stable storage URL once upload completes */
  hostedPrimaryUrl?: string | null
}
