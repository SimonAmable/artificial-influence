import { InstagramGraphError, instagramGraphGet, instagramGraphPostJson } from "@/lib/instagram/graph"

type CreateContainerResponse = { id: string }
type PublishResponse = { id: string }
type StatusResponse = { status_code?: string }

const IMAGE_POLL_INTERVAL_MS = 2_000
const IMAGE_POLL_MAX_ATTEMPTS = 45

const REEL_POLL_INTERVAL_MS = 8_000
const REEL_POLL_MAX_ATTEMPTS = 38

/**
 * Instagram Content Publishing (Instagram Login → graph.instagram.com).
 * @see https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing
 */
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
  const captionTrimmed = caption?.trim() ?? ""

  let containerId: string

  if (mediaType === "image") {
    const body: Record<string, unknown> = { image_url: mediaUrl }
    if (captionTrimmed.length > 0) {
      body.caption = captionTrimmed
    }
    const created = await instagramGraphPostJson<CreateContainerResponse>(
      instagramUserId,
      accessToken,
      "media",
      body
    )
    containerId = created.id

    // Instagram pulls image_url asynchronously; publishing immediately returns "Media ID is not available".
    await waitForContainerReady(accessToken, containerId, {
      intervalMs: IMAGE_POLL_INTERVAL_MS,
      maxAttempts: IMAGE_POLL_MAX_ATTEMPTS,
      mediaKind: "image",
    })
  } else {
    const body: Record<string, unknown> = {
      media_type: "REELS",
      video_url: mediaUrl,
    }
    if (captionTrimmed.length > 0) {
      body.caption = captionTrimmed
    }
    const created = await instagramGraphPostJson<CreateContainerResponse>(
      instagramUserId,
      accessToken,
      "media",
      body
    )
    containerId = created.id

    await waitForContainerReady(accessToken, containerId, {
      intervalMs: REEL_POLL_INTERVAL_MS,
      maxAttempts: REEL_POLL_MAX_ATTEMPTS,
      mediaKind: "reel",
    })
  }

  const published = await instagramGraphPostJson<PublishResponse>(instagramUserId, accessToken, "media_publish", {
    creation_id: containerId,
  })

  return { containerId, mediaId: published.id }
}

async function waitForContainerReady(
  accessToken: string,
  containerId: string,
  options: { intervalMs: number; maxAttempts: number; mediaKind: "image" | "reel" }
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

  throw new InstagramGraphError(
    mediaKind === "image"
      ? "Timed out waiting for Instagram to fetch and process the image. Check the URL is reachable from the public internet."
      : "Timed out waiting for Instagram to process the video. Try again later.",
    undefined,
    "CONTAINER_TIMEOUT"
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
