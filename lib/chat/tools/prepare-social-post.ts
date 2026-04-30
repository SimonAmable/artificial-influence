import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import {
  createInstagramPostJob,
  type InstagramConnectionSummary,
  type PrepareInstagramPostInput,
} from "@/lib/autopost/create-instagram-post-job"
import {
  createTikTokPostJob,
  type PrepareTikTokPostInput,
} from "@/lib/autopost/create-tiktok-post-job"
import { publishAutopostJob } from "@/lib/autopost/publish-job"
import type { AutopostJobMetadata } from "@/lib/autopost/types"
import { listSocialConnections, type SocialConnectionToolSummary } from "@/lib/chat/tools/list-social-connections"

export type PrepareSocialPostAction = "draft" | "publish" | "schedule"

export type PrepareSocialPostInput =
  | {
      provider: "instagram"
      action: PrepareSocialPostAction
      connectionId: string
      caption?: string
      scheduledAt?: string
      mediaType: "image" | "feed_video" | "reel" | "carousel" | "story"
      mediaUrl?: string
      carouselItems?: Array<{
        url: string
        kind: "image" | "video"
      }>
      storyAssetKind?: "image" | "video"
      shareToFeed?: boolean
      coverUrl?: string
      trialParams?: {
        graduationStrategy: "MANUAL" | "SS_PERFORMANCE"
      }
    }
  | {
      provider: "tiktok"
      action: PrepareSocialPostAction
      connectionId: string
      caption?: string
      scheduledAt?: string
      mode: "upload" | "direct"
      postType?: "video" | "photo"
      mediaUrl?: string
      photoItems?: string[]
      photoCoverIndex?: number
      description?: string
      privacyLevel?: string
      disableComment?: boolean
      disableDuet?: boolean
      disableStitch?: boolean
      isAigc?: boolean
      autoAddMusic?: boolean
      brandOrganicToggle?: boolean
      brandContentToggle?: boolean
    }

export type PreparedSocialPost = {
  id: string
  caption: string | null
  createdAt: string
  instagramConnectionId?: string | null
  mediaType: string
  mediaUrl: string
  metadata: AutopostJobMetadata
  scheduledAt: string | null
  socialConnectionId?: string | null
  status: string
}

export type PrepareSocialPostResult = {
  provider: "instagram" | "tiktok"
  action: PrepareSocialPostAction
  account: SocialConnectionToolSummary
  message: string
  post: PreparedSocialPost
}

type PrepareTikTokSocialInput = Omit<PrepareTikTokPostInput, "action"> & {
  action: PrepareSocialPostAction
}

interface CreatePrepareSocialPostToolOptions {
  supabase: SupabaseClient
  userId: string
  requireApproval?: boolean
}

const instagramInputSchema = z.object({
  provider: z.literal("instagram"),
  action: z.enum(["draft", "publish", "schedule"]),
  connectionId: z.string().min(1).describe("The exact connected Instagram social connection id to use."),
  caption: z.string().max(2200).optional().describe("Optional Instagram caption."),
  scheduledAt: z
    .string()
    .optional()
    .describe("Required when action is schedule. Must be a future ISO 8601 date-time string."),
  mediaType: z.enum(["image", "feed_video", "reel", "carousel", "story"]).describe("Instagram media type."),
  mediaUrl: z.string().url().optional().describe("Single public media URL for non-carousel posts."),
  carouselItems: z
    .array(
      z.object({
        url: z.string().url(),
        kind: z.enum(["image", "video"]),
      }),
    )
    .min(2)
    .max(10)
    .optional()
    .describe("Carousel items for carousel posts."),
  storyAssetKind: z
    .enum(["image", "video"])
    .optional()
    .describe("Required for story posts to tell Instagram whether the story media is an image or video."),
  shareToFeed: z
    .boolean()
    .optional()
    .describe("Optional reels setting. When false, the reel will not be shared to the main feed."),
  coverUrl: z.string().url().optional().describe("Optional public cover image URL for reels."),
  trialParams: z
    .object({
      graduationStrategy: z.enum(["MANUAL", "SS_PERFORMANCE"]),
    })
    .optional()
    .describe("Optional reels trial parameters."),
})

const tiktokInputSchema = z.object({
  provider: z.literal("tiktok"),
  action: z.enum(["draft", "publish", "schedule"]),
  connectionId: z.string().min(1).describe("The exact connected TikTok social connection id to use."),
  caption: z.string().max(2200).optional().describe("Optional TikTok title/caption."),
  scheduledAt: z
    .string()
    .optional()
    .describe("Required when action is schedule. Must be a future ISO 8601 date-time string."),
  mode: z.enum(["upload", "direct"]).describe("Whether TikTok should upload to inbox or submit a direct post."),
  postType: z.enum(["video", "photo"]).optional().describe("TikTok post type. Defaults to video."),
  mediaUrl: z.string().url().optional().describe("Single public video URL for TikTok video posts."),
  photoItems: z
    .array(z.string().url())
    .min(1)
    .max(35)
    .optional()
    .describe("Ordered public image URLs for TikTok photo posts."),
  photoCoverIndex: z.number().int().min(0).optional().describe("Optional cover image index for TikTok photo posts."),
  description: z.string().optional().describe("Optional TikTok description, mainly for photo posts."),
  privacyLevel: z.string().optional().describe("Required for TikTok direct post."),
  disableComment: z.boolean().optional(),
  disableDuet: z.boolean().optional(),
  disableStitch: z.boolean().optional(),
  isAigc: z.boolean().optional(),
  autoAddMusic: z.boolean().optional(),
  brandOrganicToggle: z.boolean().optional(),
  brandContentToggle: z.boolean().optional(),
})

function fallbackInstagramSocialAccount(connection: InstagramConnectionSummary): SocialConnectionToolSummary {
  return {
    accountType: connection.accountType,
    displayName: connection.instagramUsername,
    id: connection.id,
    instagramConnectionId: connection.id,
    instagramUserId: connection.instagramUserId,
    profileFetchedAt: connection.profileFetchedAt,
    provider: "instagram",
    scopes: [],
    status: "connected",
    tokenExpiresAt: connection.tokenExpiresAt,
    updatedAt: connection.updatedAt,
    username: connection.instagramUsername,
  }
}

async function getInstagramSocialConnectionByLegacyId({
  instagramConnectionId,
  supabase,
  userId,
}: {
  instagramConnectionId: string
  supabase: SupabaseClient
  userId: string
}) {
  const connections = await listSocialConnections({
    provider: "instagram",
    supabase,
    userId,
  })

  return (
    connections.find((connection) => connection.instagramConnectionId === instagramConnectionId)
    ?? null
  )
}

async function resolveInstagramConnection({
  connectionId,
  supabase,
  userId,
}: {
  connectionId: string
  supabase: SupabaseClient
  userId: string
}) {
  const connections = await listSocialConnections({
    provider: "instagram",
    supabase,
    userId,
  })

  const socialConnection = connections.find((connection) => connection.id === connectionId) ?? null
  if (!socialConnection?.instagramConnectionId) {
    throw new Error("Invalid or disconnected Instagram account. Pick a connected account.")
  }

  return {
    instagramConnectionId: socialConnection.instagramConnectionId,
    socialConnection,
  }
}

async function loadPreparedJob({
  fields,
  jobId,
  supabase,
  userId,
}: {
  fields: string
  jobId: string
  supabase: SupabaseClient
  userId: string
}) {
  const { data, error } = await supabase
    .from("autopost_jobs")
    .select(fields)
    .eq("id", jobId)
    .eq("user_id", userId)
    .single()

  if (error || !data) {
    throw new Error("The post was submitted, but the saved record could not be refreshed.")
  }

  return data as unknown as Record<string, unknown>
}

async function runInstagramPreparation({
  account,
  input,
  supabase,
  userId,
}: {
  account?: SocialConnectionToolSummary | null
  input: PrepareInstagramPostInput
  supabase: SupabaseClient
  userId: string
}): Promise<PrepareSocialPostResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error("Server configuration error.")
  }

  const result = await createInstagramPostJob({
    input,
    supabase,
    supabaseUrl,
    userId,
  })

  if (!result.ok) {
    throw new Error(result.message)
  }

  const resolvedAccount = account ?? fallbackInstagramSocialAccount(result.connection)

  return {
    action: input.action,
    account: resolvedAccount,
    message:
      input.action === "schedule"
        ? "Instagram post approved and scheduled."
        : input.action === "publish"
          ? "Instagram post approved and published."
          : "Instagram post approved and saved as a draft.",
    post: {
      caption: result.job.caption,
      createdAt: result.job.created_at,
      id: result.job.id,
      instagramConnectionId: result.job.instagram_connection_id,
      mediaType: result.job.media_type,
      mediaUrl: result.job.media_url,
      metadata: result.job.metadata,
      scheduledAt: result.job.scheduled_at,
      status: result.job.status,
    },
    provider: "instagram",
  }
}

async function runTikTokPreparation({
  account,
  input,
  supabase,
  userId,
}: {
  account: SocialConnectionToolSummary
  input: PrepareTikTokSocialInput
  supabase: SupabaseClient
  userId: string
}): Promise<PrepareSocialPostResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error("Server configuration error.")
  }

  const createAction = input.action === "publish" ? "draft" : input.action
  const createResult = await createTikTokPostJob({
    input: {
      ...input,
      action: createAction,
    },
    supabase,
    supabaseUrl,
    userId,
  })

  if (!createResult.ok) {
    throw new Error(createResult.message)
  }

  let job = createResult.job

  if (input.action === "publish") {
    const publishResult = await publishAutopostJob(supabase, job.id, { userId })
    if (!publishResult.ok) {
      throw new Error(publishResult.error)
    }

    const refreshed = await loadPreparedJob({
      fields: "id, media_url, caption, media_type, status, scheduled_at, created_at, social_connection_id, metadata",
      jobId: job.id,
      supabase,
      userId,
    })

    job = {
      caption: (refreshed.caption as string | null) ?? null,
      created_at: refreshed.created_at as string,
      id: refreshed.id as string,
      media_type: refreshed.media_type as
        | "tiktok_video_upload"
        | "tiktok_video_direct"
        | "tiktok_photo_upload"
        | "tiktok_photo_direct",
      media_url: refreshed.media_url as string,
      metadata: ((refreshed.metadata ?? {}) as AutopostJobMetadata),
      scheduled_at: (refreshed.scheduled_at as string | null) ?? null,
      social_connection_id: refreshed.social_connection_id as string,
      status: refreshed.status as string,
    }
  }

  const publishMessage =
    input.mode === "upload"
      ? "TikTok post approved and sent to the account inbox."
      : "TikTok post approved and submitted to TikTok."

  return {
    action: input.action,
    account,
    message:
      input.action === "schedule"
        ? "TikTok post approved and scheduled."
        : input.action === "publish"
          ? publishMessage
          : "TikTok post approved and saved as a draft.",
    post: {
      caption: job.caption,
      createdAt: job.created_at,
      id: job.id,
      mediaType: job.media_type,
      mediaUrl: job.media_url,
      metadata: job.metadata,
      scheduledAt: job.scheduled_at,
      socialConnectionId: job.social_connection_id,
      status: job.status,
    },
    provider: "tiktok",
  }
}

export async function prepareSocialPost({
  input,
  supabase,
  userId,
}: {
  input: PrepareSocialPostInput
  supabase: SupabaseClient
  userId: string
}): Promise<PrepareSocialPostResult> {
  if (input.provider === "instagram") {
    const resolved = await resolveInstagramConnection({
      connectionId: input.connectionId,
      supabase,
      userId,
    })

    return runInstagramPreparation({
      account: resolved.socialConnection,
      input: {
        action: input.action,
        caption: input.caption,
        carouselItems: input.carouselItems,
        coverUrl: input.coverUrl,
        instagramConnectionId: resolved.instagramConnectionId,
        mediaType: input.mediaType,
        mediaUrl: input.mediaUrl,
        scheduledAt: input.scheduledAt,
        shareToFeed: input.shareToFeed,
        storyAssetKind: input.storyAssetKind,
        trialParams: input.trialParams,
      },
      supabase,
      userId,
    })
  }

  const account = (
    await listSocialConnections({
      provider: "tiktok",
      supabase,
      userId,
    })
  ).find((connection) => connection.id === input.connectionId)

  if (!account) {
    throw new Error("Invalid or disconnected TikTok account. Pick a connected account.")
  }

  return runTikTokPreparation({
    account,
    input: {
      action: input.action,
      autoAddMusic: input.autoAddMusic,
      brandContentToggle: input.brandContentToggle,
      brandOrganicToggle: input.brandOrganicToggle,
      caption: input.caption,
      description: input.description,
      disableComment: input.disableComment,
      disableDuet: input.disableDuet,
      disableStitch: input.disableStitch,
      isAigc: input.isAigc,
      mediaUrl: input.mediaUrl,
      mode: input.mode,
      photoCoverIndex: input.photoCoverIndex,
      photoItems: input.photoItems,
      postType: input.postType,
      privacyLevel: input.privacyLevel,
      scheduledAt: input.scheduledAt,
      tiktokConnectionId: account.id,
    },
    supabase,
    userId,
  })
}

export async function prepareInstagramPostFromLegacyInput({
  input,
  supabase,
  userId,
}: {
  input: PrepareInstagramPostInput
  supabase: SupabaseClient
  userId: string
}) {
  const account = await getInstagramSocialConnectionByLegacyId({
    instagramConnectionId: input.instagramConnectionId,
    supabase,
    userId,
  })

  return runInstagramPreparation({
    account,
    input,
    supabase,
    userId,
  })
}

export function createPrepareSocialPostTool({
  supabase,
  userId,
  requireApproval = true,
}: CreatePrepareSocialPostToolOptions) {
  return tool({
    description:
      "Create an Instagram or TikTok post as a draft, publish it immediately, or schedule it for later. This tool requires explicit user approval in the tool UI before writing or publishing any post in normal chat.",
    inputSchema: z.discriminatedUnion("provider", [instagramInputSchema, tiktokInputSchema]),
    strict: true,
    needsApproval: requireApproval,
    execute: async (input) =>
      prepareSocialPost({
        input,
        supabase,
        userId,
      }),
  })
}
