import { InstagramGraphError, instagramGraphGet, instagramGraphPostJson } from "@/lib/instagram/graph"

type CreateContainerResponse = { id: string }
type PublishResponse = { id: string }
type StatusResponse = { status_code?: string }

const IMAGE_POLL_INTERVAL_MS = 2_000
const IMAGE_POLL_MAX_ATTEMPTS = 45

const VIDEO_POLL_INTERVAL_MS = 8_000
const VIDEO_POLL_MAX_ATTEMPTS = 38

const CAROUSEL_PARENT_POLL_INTERVAL_MS = 3_000
const CAROUSEL_PARENT_POLL_MAX_ATTEMPTS = 60

export type PublishJobSpec =
  | { kind: "feed_image"; mediaUrl: string; caption: string | null; altText?: string }
  | { kind: "feed_video"; mediaUrl: string; caption: string | null }
  | {
      kind: "reel"
      mediaUrl: string
      caption: string | null
      shareToFeed?: boolean
      coverUrl?: string | null
      trialParams?: { graduationStrategy: "MANUAL" | "SS_PERFORMANCE" }
    }
  | { kind: "story"; mediaUrl: string; assetKind: "image" | "video" }
  | { kind: "carousel"; caption: string | null; items: { url: string; kind: "image" | "video" }[] }

/**
 * Instagram Content Publishing (Instagram Login → graph.instagram.com).
 * @see https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing
 */
export async function publishInstagramContent({
  accessToken,
  instagramUserId,
  job,
}: {
  accessToken: string
  instagramUserId: string
  job: PublishJobSpec
}): Promise<{ containerId: string; mediaId: string }> {
  switch (job.kind) {
    case "feed_image":
      return publishFeedImage({
        accessToken,
        instagramUserId,
        mediaUrl: job.mediaUrl,
        caption: job.caption,
        altText: job.altText,
      })
    case "feed_video":
      return publishFeedVideo({
        accessToken,
        instagramUserId,
        mediaUrl: job.mediaUrl,
        caption: job.caption,
      })
    case "reel":
      return publishReel({
        accessToken,
        instagramUserId,
        mediaUrl: job.mediaUrl,
        caption: job.caption,
        shareToFeed: job.shareToFeed,
        coverUrl: job.coverUrl,
        trialParams: job.trialParams,
      })
    case "story":
      return publishStory({
        accessToken,
        instagramUserId,
        mediaUrl: job.mediaUrl,
        assetKind: job.assetKind,
      })
    case "carousel":
      return publishCarousel({
        accessToken,
        instagramUserId,
        caption: job.caption,
        items: job.items,
      })
  }
}

/** @deprecated Prefer publishInstagramContent with explicit job kind. */
export async function publishToInstagramFeed({
  accessToken,
  instagramUserId,
  mediaUrl,
  caption,
  mediaType,
}: {
  accessToken: string
  instagramUserId: string
  mediaUrl: string
  caption: string | null
  mediaType: "image" | "reel"
}): Promise<{ containerId: string; mediaId: string }> {
  if (mediaType === "image") {
    return publishInstagramContent({
      accessToken,
      instagramUserId,
      job: { kind: "feed_image", mediaUrl, caption },
    })
  }
  return publishInstagramContent({
    accessToken,
    instagramUserId,
    job: { kind: "reel", mediaUrl, caption },
  })
}

async function publishFeedImage({
  accessToken,
  instagramUserId,
  mediaUrl,
  caption,
  altText,
}: {
  accessToken: string
  instagramUserId: string
  mediaUrl: string
  caption: string | null
  altText?: string
}): Promise<{ containerId: string; mediaId: string }> {
  const captionTrimmed = caption?.trim() ?? ""
  const body: Record<string, unknown> = { image_url: mediaUrl }
  if (captionTrimmed.length > 0) {
    body.caption = captionTrimmed
  }
  if (altText?.trim()) {
    body.alt_text = altText.trim()
  }

  const created = await instagramGraphPostJson<CreateContainerResponse>(instagramUserId, accessToken, "media", body)
  const containerId = created.id

  await waitForContainerReady(accessToken, containerId, {
    intervalMs: IMAGE_POLL_INTERVAL_MS,
    maxAttempts: IMAGE_POLL_MAX_ATTEMPTS,
    mediaKind: "image",
  })

  return finalizePublish(accessToken, instagramUserId, containerId)
}

async function publishFeedVideo({
  accessToken,
  instagramUserId,
  mediaUrl,
  caption,
}: {
  accessToken: string
  instagramUserId: string
  mediaUrl: string
  caption: string | null
}): Promise<{ containerId: string; mediaId: string }> {
  const captionTrimmed = caption?.trim() ?? ""
  const body: Record<string, unknown> = {
    media_type: "VIDEO",
    video_url: mediaUrl,
  }
  if (captionTrimmed.length > 0) {
    body.caption = captionTrimmed
  }

  const created = await instagramGraphPostJson<CreateContainerResponse>(instagramUserId, accessToken, "media", body)
  const containerId = created.id

  await waitForContainerReady(accessToken, containerId, {
    intervalMs: VIDEO_POLL_INTERVAL_MS,
    maxAttempts: VIDEO_POLL_MAX_ATTEMPTS,
    mediaKind: "video",
  })

  return finalizePublish(accessToken, instagramUserId, containerId)
}

async function publishReel({
  accessToken,
  instagramUserId,
  mediaUrl,
  caption,
  shareToFeed = true,
  coverUrl,
  trialParams,
}: {
  accessToken: string
  instagramUserId: string
  mediaUrl: string
  caption: string | null
  shareToFeed?: boolean
  coverUrl?: string | null
  trialParams?: { graduationStrategy: "MANUAL" | "SS_PERFORMANCE" }
}): Promise<{ containerId: string; mediaId: string }> {
  const captionTrimmed = caption?.trim() ?? ""
  const body: Record<string, unknown> = {
    media_type: "REELS",
    video_url: mediaUrl,
    share_to_feed: shareToFeed,
  }
  if (captionTrimmed.length > 0) {
    body.caption = captionTrimmed
  }
  if (coverUrl?.trim()) {
    body.cover_url = coverUrl.trim()
  }
  if (trialParams) {
    body.trial_params = {
      graduation_strategy:
        trialParams.graduationStrategy === "SS_PERFORMANCE" ? "SS_PERFORMANCE" : "MANUAL",
    }
  }

  const created = await instagramGraphPostJson<CreateContainerResponse>(instagramUserId, accessToken, "media", body)
  const containerId = created.id

  await waitForContainerReady(accessToken, containerId, {
    intervalMs: VIDEO_POLL_INTERVAL_MS,
    maxAttempts: VIDEO_POLL_MAX_ATTEMPTS,
    mediaKind: "reel",
  })

  return finalizePublish(accessToken, instagramUserId, containerId)
}

async function publishStory({
  accessToken,
  instagramUserId,
  mediaUrl,
  assetKind,
}: {
  accessToken: string
  instagramUserId: string
  mediaUrl: string
  assetKind: "image" | "video"
}): Promise<{ containerId: string; mediaId: string }> {
  const body: Record<string, unknown> = { media_type: "STORIES" }
  if (assetKind === "image") {
    body.image_url = mediaUrl
  } else {
    body.video_url = mediaUrl
  }

  const created = await instagramGraphPostJson<CreateContainerResponse>(instagramUserId, accessToken, "media", body)
  const containerId = created.id

  await waitForContainerReady(accessToken, containerId, {
    intervalMs: assetKind === "image" ? IMAGE_POLL_INTERVAL_MS : VIDEO_POLL_INTERVAL_MS,
    maxAttempts: assetKind === "image" ? IMAGE_POLL_MAX_ATTEMPTS : VIDEO_POLL_MAX_ATTEMPTS,
    mediaKind: assetKind === "image" ? "story_image" : "story_video",
  })

  return finalizePublish(accessToken, instagramUserId, containerId)
}

async function publishCarousel({
  accessToken,
  instagramUserId,
  caption,
  items,
}: {
  accessToken: string
  instagramUserId: string
  caption: string | null
  items: { url: string; kind: "image" | "video" }[]
}): Promise<{ containerId: string; mediaId: string }> {
  if (items.length < 2 || items.length > 10) {
    throw new InstagramGraphError("Carousel must include between 2 and 10 items.", undefined, "CAROUSEL_ITEM_COUNT")
  }

  const childIds: string[] = []

  for (const item of items) {
    const childBody: Record<string, unknown> = {
      is_carousel_item: true,
    }
    if (item.kind === "image") {
      childBody.image_url = item.url
    } else {
      childBody.media_type = "VIDEO"
      childBody.video_url = item.url
    }

    const created = await instagramGraphPostJson<CreateContainerResponse>(
      instagramUserId,
      accessToken,
      "media",
      childBody
    )
    const childId = created.id

    await waitForContainerReady(accessToken, childId, {
      intervalMs: item.kind === "image" ? IMAGE_POLL_INTERVAL_MS : VIDEO_POLL_INTERVAL_MS,
      maxAttempts: item.kind === "image" ? IMAGE_POLL_MAX_ATTEMPTS : VIDEO_POLL_MAX_ATTEMPTS,
      mediaKind: item.kind === "image" ? "image" : "video",
    })

    childIds.push(childId)
  }

  const captionTrimmed = caption?.trim() ?? ""
  const parentBody: Record<string, unknown> = {
    media_type: "CAROUSEL",
    children: childIds.join(","),
  }
  if (captionTrimmed.length > 0) {
    parentBody.caption = captionTrimmed
  }

  const parentCreated = await instagramGraphPostJson<CreateContainerResponse>(
    instagramUserId,
    accessToken,
    "media",
    parentBody
  )
  const containerId = parentCreated.id

  await waitForContainerReady(accessToken, containerId, {
    intervalMs: CAROUSEL_PARENT_POLL_INTERVAL_MS,
    maxAttempts: CAROUSEL_PARENT_POLL_MAX_ATTEMPTS,
    mediaKind: "carousel",
  })

  return finalizePublish(accessToken, instagramUserId, containerId)
}

async function finalizePublish(
  accessToken: string,
  instagramUserId: string,
  containerId: string
): Promise<{ containerId: string; mediaId: string }> {
  const published = await instagramGraphPostJson<PublishResponse>(instagramUserId, accessToken, "media_publish", {
    creation_id: containerId,
  })
  return { containerId, mediaId: published.id }
}

async function waitForContainerReady(
  accessToken: string,
  containerId: string,
  options: {
    intervalMs: number
    maxAttempts: number
    mediaKind: "image" | "video" | "reel" | "carousel" | "story_image" | "story_video"
  }
): Promise<void> {
  const { intervalMs, maxAttempts, mediaKind } = options

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await instagramGraphGet<StatusResponse>(
      containerId,
      accessToken,
      "?fields=status_code"
    )

    const code = status.status_code
    if (code === "FINISHED" || code === "PUBLISHED") {
      return
    }
    if (code === "ERROR" || code === "EXPIRED") {
      throw new InstagramGraphError(
        `Media container status: ${code || "unknown"}. Check file format, size, and that the media URL is public HTTPS.`,
        undefined,
        "CONTAINER_STATUS"
      )
    }

    await sleep(intervalMs)
  }

  const timeoutMessage: Record<typeof mediaKind, string> = {
    image:
      "Timed out waiting for Instagram to fetch and process the image. Check the URL is reachable from the public internet.",
    video: "Timed out waiting for Instagram to process the video. Try again later.",
    reel: "Timed out waiting for Instagram to process the reel. Try again later.",
    carousel: "Timed out waiting for Instagram to process the carousel. Try again later.",
    story_image:
      "Timed out waiting for Instagram to process the story image. Check the URL is reachable from the public internet.",
    story_video: "Timed out waiting for Instagram to process the story video. Try again later.",
  }

  throw new InstagramGraphError(timeoutMessage[mediaKind], undefined, "CONTAINER_TIMEOUT")
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
