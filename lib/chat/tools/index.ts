import type { SupabaseClient } from "@supabase/supabase-js"
import type { SkillCatalogEntry } from "@/lib/chat/skills/catalog"
import type { AvailableChatImageReference } from "@/lib/chat/tools/generate-image-with-nano-banana"
import { createGenerateImageTool } from "@/lib/chat/tools/generate-image"
import { createGenerateImageWithNanoBananaTool } from "@/lib/chat/tools/generate-image-with-nano-banana"
import type {
  AvailableChatAudioReference,
  AvailableChatVideoReference,
} from "@/lib/chat/tools/generate-video"
import { createGenerateVideoTool } from "@/lib/chat/tools/generate-video"
import { createGetBrandContextTool } from "@/lib/chat/tools/get-brand-context"
import { createListInstagramConnectionsTool } from "@/lib/chat/tools/list-instagram-connections"
import { createListRecentGenerationsTool } from "@/lib/chat/tools/list-recent-generations"
import { createSaveGenerationAsAssetTool } from "@/lib/chat/tools/save-generation-as-asset"
import { createPrepareInstagramPostTool } from "@/lib/chat/tools/prepare-instagram-post"
import { createSearchAssetsTool } from "@/lib/chat/tools/search-assets"
import { createSearchModelsTool } from "@/lib/chat/tools/search-models"
import { createActivateSkillTool, createSaveSkillTool } from "@/lib/chat/tools/skills"
import { createExtractVideoFramesTool } from "@/lib/chat/tools/extract-video-frames"
import { createComposeTimelineVideoTool } from "@/lib/chat/tools/compose-timeline-video"
import { createAwaitGenerationTool } from "@/lib/chat/tools/await-generation"
import { createEstimateModelLatencyTool } from "@/lib/chat/tools/estimate-model-latency"
import { createListThreadMediaTool } from "@/lib/chat/tools/list-thread-media"

interface CreateCreativeChatToolsOptions {
  availableReferences: AvailableChatImageReference[]
  availableVideoReferences: AvailableChatVideoReference[]
  availableAudioReferences: AvailableChatAudioReference[]
  supabase: SupabaseClient
  threadId?: string
  userId: string
  skillsCatalog?: SkillCatalogEntry[]
}

export function createCreativeChatTools({
  availableReferences,
  availableVideoReferences,
  availableAudioReferences,
  supabase,
  threadId,
  userId,
  skillsCatalog = [],
}: CreateCreativeChatToolsOptions) {
  const skillSlugs = skillsCatalog.map((entry) => entry.slug).filter(Boolean) as string[]
  const activateSkillTool =
    skillSlugs.length > 0
      ? createActivateSkillTool({
          supabase,
          userId,
          skillSlugs: skillSlugs as [string, ...string[]],
        })
      : null

  const listThreadMediaTool = threadId
    ? createListThreadMediaTool({ supabase, threadId, userId })
    : null

  const composeTimelineVideoTool = threadId
    ? createComposeTimelineVideoTool({ supabase, threadId, userId })
    : null

  return {
    ...(listThreadMediaTool ? { listThreadMedia: listThreadMediaTool } : {}),
    ...(composeTimelineVideoTool ? { composeTimelineVideo: composeTimelineVideoTool } : {}),
    listInstagramConnections: createListInstagramConnectionsTool({
      supabase,
      userId,
    }),
    prepareInstagramPost: createPrepareInstagramPostTool({
      supabase,
      userId,
    }),
    generateImage: createGenerateImageTool({
      availableReferences,
      supabase,
      threadId,
      userId,
    }),
    generateImageWithNanoBanana: createGenerateImageWithNanoBananaTool({
      availableReferences,
      supabase,
      threadId,
      userId,
    }),
    generateVideo: createGenerateVideoTool({
      availableReferences,
      availableVideoReferences,
      availableAudioReferences,
      supabase,
      threadId,
      userId,
    }),
    extractVideoFrames: createExtractVideoFramesTool({
      availableImageReferences: availableReferences,
      availableVideoReferences,
      supabase,
      threadId,
      userId,
    }),
    getBrandContext: createGetBrandContextTool({
      supabase,
      userId,
    }),
    listRecentGenerations: createListRecentGenerationsTool({
      supabase,
      userId,
    }),
    saveGenerationAsAsset: createSaveGenerationAsAssetTool({
      supabase,
      userId,
    }),
    searchAssets: createSearchAssetsTool({
      supabase,
      userId,
    }),
    searchModels: createSearchModelsTool({
      supabase,
    }),
    awaitGeneration: createAwaitGenerationTool({ supabase, userId }),
    estimateModelLatency: createEstimateModelLatencyTool({ supabase, userId }),
    saveSkill: createSaveSkillTool({
      supabase,
      userId,
    }),
    ...(activateSkillTool ? { activateSkill: activateSkillTool } : {}),
  }
}
