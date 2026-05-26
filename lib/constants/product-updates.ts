export type ProductUpdateTag = "feature" | "improvement" | "fix"

export type ProductUpdate = {
  id: string
  title: string
  /** Optional; not shown in the notifications UI */
  short?: string
  description: string
  publishedAt: string
  imageSrc: string
  fallbackImageSrc: string
  ctaLabel?: string
  ctaHref?: string
  tag?: ProductUpdateTag
}

export const DEFAULT_PRODUCT_UPDATE_FALLBACK_IMAGE = "/blog_fallback_image.png" as const

const NOTIFICATION_IMAGE = DEFAULT_PRODUCT_UPDATE_FALLBACK_IMAGE

export const PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: "notifications-tab-2026-05-25",
    title: "Notifications",
    description:
      "Open account settings and tap Notifications for short updates on new features.",
    publishedAt: "2026-05-25T12:00:00.000Z",
    imageSrc: NOTIFICATION_IMAGE,
    fallbackImageSrc: NOTIFICATION_IMAGE,
    tag: "feature",
  },
]

function sortByPublishedAtDesc(updates: ProductUpdate[]): ProductUpdate[] {
  return [...updates].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}

export const SORTED_PRODUCT_UPDATES = sortByPublishedAtDesc(PRODUCT_UPDATES)

export function getLatestProductUpdate(): ProductUpdate | null {
  return SORTED_PRODUCT_UPDATES[0] ?? null
}

export function getLatestProductUpdatePublishedAt(): string | null {
  return getLatestProductUpdate()?.publishedAt ?? null
}

export function hasUnreadProductUpdates(lastSeenAt: string | null): boolean {
  const latest = getLatestProductUpdatePublishedAt()
  if (!latest) return false
  if (!lastSeenAt) return true
  return new Date(latest).getTime() > new Date(lastSeenAt).getTime()
}
