"use client"

import type {
  PrepareInstagramPostToolInput,
  PrepareSocialPostToolInput,
  SocialConnectionToolSummary,
  SocialProvider,
} from "@/lib/chat/agent-tool-part-types"

export function formatInstagramSchedule(value?: string | null) {
  if (!value) return null

  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

export function socialProviderLabel(provider?: SocialProvider | null) {
  return provider === "tiktok" ? "TikTok" : "Instagram"
}

export function socialAccountLabel(
  account?: SocialConnectionToolSummary | null,
  fallbackId?: string | null,
) {
  if (!account) {
    return fallbackId || "Social account"
  }

  return (
    account.displayName
    || account.username
    || (account.provider === "instagram" ? account.instagramConnectionId : null)
    || fallbackId
    || `${socialProviderLabel(account.provider)} account`
  )
}

export function InstagramMediaPreview({
  input,
}: {
  input?: PrepareInstagramPostToolInput
}) {
  if (!input) {
    return null
  }

  const items =
    input.mediaType === "carousel"
      ? input.carouselItems ?? []
      : input.mediaUrl
        ? [{ kind: input.mediaType === "image" ? "image" : "video", url: input.mediaUrl }]
        : []

  if (items.length === 0) {
    return null
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.slice(0, 4).map((item, index) =>
        item.kind === "image" ? (
          <img
            key={`${item.url}-${index}`}
            src={item.url}
            alt=""
            className="max-h-48 w-full rounded-xl border border-border/60 object-cover"
          />
        ) : (
          <video
            key={`${item.url}-${index}`}
            src={item.url}
            controls
            className="max-h-48 w-full rounded-xl border border-border/60 bg-black"
          />
        ),
      )}
    </div>
  )
}

export function SocialPostMediaPreview({
  input,
}: {
  input?: PrepareSocialPostToolInput
}) {
  if (!input) {
    return null
  }

  const items =
    input.provider === "instagram"
      ? input.mediaType === "carousel"
        ? input.carouselItems ?? []
        : input.mediaUrl
          ? [{ kind: input.mediaType === "image" ? "image" : "video", url: input.mediaUrl }]
          : []
      : input.postType === "photo"
        ? (input.photoItems ?? []).map((url) => ({ kind: "image" as const, url }))
        : input.mediaUrl
          ? [{ kind: "video" as const, url: input.mediaUrl }]
          : []

  if (items.length === 0) {
    return null
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.slice(0, 4).map((item, index) =>
        item.kind === "image" ? (
          <img
            key={`${item.url}-${index}`}
            src={item.url}
            alt=""
            className="max-h-48 w-full rounded-xl border border-border/60 object-cover"
          />
        ) : (
          <video
            key={`${item.url}-${index}`}
            src={item.url}
            controls
            className="max-h-48 w-full rounded-xl border border-border/60 bg-black"
          />
        ),
      )}
    </div>
  )
}
