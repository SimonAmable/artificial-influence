import { currentProduct } from "@/lib/product/current"
import { presenceStudioProduct } from "@/lib/product/products/presence-studio"
import type { ProductId } from "@/lib/product/types"

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

export const DEFAULT_PRODUCT_UPDATE_FALLBACK_IMAGE = "/notificaitons/notifications.png" as const

const NOTIFICATION_IMAGE = DEFAULT_PRODUCT_UPDATE_FALLBACK_IMAGE
const TEMPLATE_IMAGE = "/notificaitons/templates.png" as const

const UNICAN_PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: "templates-gallery-2026-05-27",
    title: "Templates",
    description:
      "Instantly copy winning trends with reusable templates, then jump straight into a guided run.",
    publishedAt: "2026-05-27T12:00:00.000Z",
    imageSrc: TEMPLATE_IMAGE,
    fallbackImageSrc: NOTIFICATION_IMAGE,
    ctaLabel: "Browse templates",
    ctaHref: "/templates",
    tag: "feature",
  },
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

const PRESENCE_STUDIO_PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: "presence-beta-launch-2026-07-08",
    title: "Beta launch",
    description:
      "Welcome to the Presence Studio beta. Create AI influencers, generate character-led content, and build your posting pipeline from one focused studio.",
    publishedAt: "2026-07-08T12:00:00.000Z",
    imageSrc: presenceStudioProduct.logo,
    fallbackImageSrc: presenceStudioProduct.logo,
    ctaLabel: "Open dashboard",
    ctaHref: "/dashboard",
    tag: "feature",
  },
]

const PRODUCT_UPDATES_BY_ID: Record<ProductId, ProductUpdate[]> = {
  unican: UNICAN_PRODUCT_UPDATES,
  "presence-studio": PRESENCE_STUDIO_PRODUCT_UPDATES,
}

export const PRODUCT_UPDATES = PRODUCT_UPDATES_BY_ID[currentProduct.id]

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
