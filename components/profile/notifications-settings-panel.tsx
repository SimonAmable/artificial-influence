"use client"

import * as React from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Sparkle } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DEFAULT_PRODUCT_UPDATE_FALLBACK_IMAGE,
  SORTED_PRODUCT_UPDATES,
  type ProductUpdate,
  type ProductUpdateTag,
} from "@/lib/constants/product-updates"
import { cn } from "@/lib/utils"

export type NotificationsSettingsPanelProps = {
  variant?: "modal"
  onViewed?: () => void
}

const TAG_LABELS: Record<ProductUpdateTag, string> = {
  feature: "New",
  improvement: "Improved",
  fix: "Fix",
}

function formatUpdateTime(publishedAt: string): string {
  const date = new Date(publishedAt)
  if (Number.isNaN(date.getTime())) return ""

  const ageMs = Date.now() - date.getTime()
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

  if (ageMs >= 0 && ageMs < thirtyDaysMs) {
    return formatDistanceToNow(date, { addSuffix: true })
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function NotificationUpdateImage({
  title,
  imageSrc,
  fallbackImageSrc,
}: {
  title: string
  imageSrc: string
  fallbackImageSrc: string
}) {
  const [src, setSrc] = React.useState(imageSrc)
  const [showIconFallback, setShowIconFallback] = React.useState(false)

  React.useEffect(() => {
    setSrc(imageSrc)
    setShowIconFallback(false)
  }, [imageSrc, fallbackImageSrc])

  if (showIconFallback) {
    return (
      <div
        className="flex aspect-[16/10] w-full items-center justify-center rounded-xl border border-border/60 bg-muted/40"
        aria-hidden
      >
        <Sparkle className="size-8 text-primary/60" weight="regular" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={title}
      loading="lazy"
      decoding="async"
      className="aspect-[16/10] w-full rounded-xl border border-border/60 bg-muted object-cover"
      onError={() => {
        if (src !== fallbackImageSrc && fallbackImageSrc) {
          setSrc(fallbackImageSrc)
          return
        }
        if (src !== DEFAULT_PRODUCT_UPDATE_FALLBACK_IMAGE) {
          setSrc(DEFAULT_PRODUCT_UPDATE_FALLBACK_IMAGE)
          return
        }
        setShowIconFallback(true)
      }}
    />
  )
}

function ProductUpdateCard({ update }: { update: ProductUpdate }) {
  const isExternalCta =
    update.ctaHref?.startsWith("http://") || update.ctaHref?.startsWith("https://")

  return (
    <article className="overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
      <NotificationUpdateImage
        title={update.title}
        imageSrc={update.imageSrc}
        fallbackImageSrc={update.fallbackImageSrc}
      />
      <div className="space-y-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            {update.title}
          </h3>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {update.tag ? (
              <Badge variant="secondary" className="text-xs font-medium">
                {TAG_LABELS[update.tag]}
              </Badge>
            ) : null}
            <time
              dateTime={update.publishedAt}
              className="text-xs text-muted-foreground"
            >
              {formatUpdateTime(update.publishedAt)}
            </time>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-foreground/90">{update.description}</p>
        {update.ctaHref && update.ctaLabel ? (
          <Button asChild size="sm" className="mt-1 rounded-full">
            {isExternalCta ? (
              <a href={update.ctaHref} target="_blank" rel="noopener noreferrer">
                {update.ctaLabel}
              </a>
            ) : (
              <Link href={update.ctaHref}>{update.ctaLabel}</Link>
            )}
          </Button>
        ) : null}
      </div>
    </article>
  )
}

export function NotificationsSettingsPanel({
  variant = "modal",
  onViewed,
}: NotificationsSettingsPanelProps) {
  const isModal = variant === "modal"

  React.useEffect(() => {
    onViewed?.()
  }, [onViewed])

  return (
    <div className={cn("w-full min-w-0 space-y-6", isModal && "min-w-0")}>
      <p className="text-base font-semibold text-foreground">
        Product updates and new features
      </p>

      {SORTED_PRODUCT_UPDATES.length === 0 ? (
        <p className="text-sm text-muted-foreground">No updates yet. Check back soon.</p>
      ) : (
        <ul className="space-y-4">
          {SORTED_PRODUCT_UPDATES.map((update) => (
            <li key={update.id}>
              <ProductUpdateCard update={update} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
