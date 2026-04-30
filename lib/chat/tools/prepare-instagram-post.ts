import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { prepareInstagramPostFromLegacyInput } from "@/lib/chat/tools/prepare-social-post"

interface CreatePrepareInstagramPostToolOptions {
  supabase: SupabaseClient
  userId: string
  requireApproval?: boolean
}

export function createPrepareInstagramPostTool({
  supabase,
  userId,
  requireApproval = true,
}: CreatePrepareInstagramPostToolOptions) {
  return tool({
    description:
      "Create an Instagram post as a draft, publish it immediately, or schedule it for later. This tool is Instagram-only and requires explicit user approval in the tool UI before writing or publishing any post in normal chat.",
    inputSchema: z.object({
      action: z
        .enum(["draft", "publish", "schedule"])
        .describe("Whether to save a draft, publish now, or schedule the post for later publishing."),
      mediaType: z
        .enum(["image", "feed_video", "reel", "carousel", "story"])
        .describe("Instagram media type."),
      instagramConnectionId: z.string().min(1).describe("The exact connected Instagram account id to use."),
      caption: z.string().max(2200).optional().describe("Optional Instagram caption."),
      scheduledAt: z
        .string()
        .optional()
        .describe("Required when action is schedule. Must be a future ISO 8601 date-time string."),
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
      coverUrl: z
        .string()
        .url()
        .optional()
        .describe("Optional public cover image URL for reels."),
      trialParams: z
        .object({
          graduationStrategy: z.enum(["MANUAL", "SS_PERFORMANCE"]),
        })
        .optional()
        .describe("Optional reels trial parameters."),
    }),
    strict: true,
    needsApproval: requireApproval,
    execute: async (input) => {
      const result = await prepareInstagramPostFromLegacyInput({
        input,
        supabase,
        userId,
      })

      return {
        action: input.action,
        instagramAccount: {
          accountType: result.account.accountType,
          id: result.post.instagramConnectionId ?? result.account.instagramConnectionId ?? result.account.id,
          instagramUserId: result.account.instagramUserId,
          instagramUsername: result.account.username,
          profileFetchedAt: result.account.profileFetchedAt,
          tokenExpiresAt: result.account.tokenExpiresAt,
          updatedAt: result.account.updatedAt,
        },
        message: result.message,
        post: {
          caption: result.post.caption,
          createdAt: result.post.createdAt,
          id: result.post.id,
          instagramConnectionId: result.post.instagramConnectionId ?? "",
          mediaType: result.post.mediaType,
          mediaUrl: result.post.mediaUrl,
          metadata: result.post.metadata,
          scheduledAt: result.post.scheduledAt,
          status: result.post.status,
        },
      }
    },
  })
}
