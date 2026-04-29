import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { createInstagramPostJob } from "@/lib/autopost/create-instagram-post-job"

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

      return {
        action: input.action,
        instagramAccount: result.connection,
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
      }
    },
  })
}
