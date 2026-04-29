const TIKTOK_API_BASE = "https://open.tiktokapis.com"

export class TikTokApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly logId?: string,
    readonly status?: number
  ) {
    super(logId ? `${message} (TikTok log ${logId})` : message)
    this.name = "TikTokApiError"
  }
}

type TikTokEnvelope<T> = {
  data?: T
  error?: {
    code?: string
    message?: string
    log_id?: string
  }
}

export type TikTokCreatorInfo = {
  creator_avatar_url?: string
  creator_username?: string
  creator_nickname?: string
  privacy_level_options?: string[]
  comment_disabled?: boolean
  duet_disabled?: boolean
  stitch_disabled?: boolean
  max_video_post_duration_sec?: number
}

export type TikTokInitPublishResponse = {
  publish_id?: string
  upload_url?: string
}

export type TikTokPublishStatus = {
  status?: string
  fail_reason?: string
  publicaly_available_post_id?: string[] | number[]
  uploaded_bytes?: number
  downloaded_bytes?: number
}

export type TikTokDirectVideoPostInfo = {
  title?: string
  privacyLevel: string
  disableComment?: boolean
  disableDuet?: boolean
  disableStitch?: boolean
  isAigc?: boolean
  brandOrganicToggle?: boolean
  brandContentToggle?: boolean
}

function tiktokMessage<T>(payload: TikTokEnvelope<T>, fallback: string) {
  return payload.error?.message || payload.error?.code || fallback
}

async function postTikTokJson<T>({
  accessToken,
  path,
  body,
}: {
  accessToken: string
  path: string
  body: unknown
}): Promise<T> {
  const response = await fetch(`${TIKTOK_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  const payload = (await response.json()) as TikTokEnvelope<T>
  const code = payload.error?.code

  if (!response.ok || (code && code !== "ok")) {
    throw new TikTokApiError(
      tiktokMessage(payload, "TikTok API request failed."),
      code,
      payload.error?.log_id,
      response.status
    )
  }

  if (!payload.data) {
    throw new TikTokApiError("TikTok API response was missing data.", code, payload.error?.log_id, response.status)
  }

  return payload.data
}

export async function queryTikTokCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
  return postTikTokJson<TikTokCreatorInfo>({
    accessToken,
    path: "/v2/post/publish/creator_info/query/",
    body: {},
  })
}

export async function initTikTokInboxVideoUpload(params: {
  accessToken: string
  videoUrl: string
}): Promise<TikTokInitPublishResponse> {
  return postTikTokJson<TikTokInitPublishResponse>({
    accessToken: params.accessToken,
    path: "/v2/post/publish/inbox/video/init/",
    body: {
      source_info: {
        source: "PULL_FROM_URL",
        video_url: params.videoUrl,
      },
    },
  })
}

export async function initTikTokDirectVideoPost(params: {
  accessToken: string
  videoUrl: string
  postInfo: TikTokDirectVideoPostInfo
}): Promise<TikTokInitPublishResponse> {
  return postTikTokJson<TikTokInitPublishResponse>({
    accessToken: params.accessToken,
    path: "/v2/post/publish/video/init/",
    body: {
      post_info: {
        title: params.postInfo.title,
        privacy_level: params.postInfo.privacyLevel,
        disable_comment: params.postInfo.disableComment === true,
        disable_duet: params.postInfo.disableDuet === true,
        disable_stitch: params.postInfo.disableStitch === true,
        is_aigc: params.postInfo.isAigc === true,
        brand_organic_toggle: params.postInfo.brandOrganicToggle === true,
        brand_content_toggle: params.postInfo.brandContentToggle === true,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: params.videoUrl,
      },
    },
  })
}

export async function fetchTikTokPublishStatus(params: {
  accessToken: string
  publishId: string
}): Promise<TikTokPublishStatus> {
  return postTikTokJson<TikTokPublishStatus>({
    accessToken: params.accessToken,
    path: "/v2/post/publish/status/fetch/",
    body: {
      publish_id: params.publishId,
    },
  })
}
