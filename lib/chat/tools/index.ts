import type { SupabaseClient } from "@supabase/supabase-js"
import type { SkillCatalogEntry } from "@/lib/chat/skills/catalog"
import type { AutomationPromptAttachment } from "@/lib/automations/prompt-payload"
import { createGenerateAudioTool } from "@/lib/chat/tools/generate-audio"
import type { AvailableChatImageReference } from "@/lib/chat/tools/image-reference-types"
import { createGenerateImageTool } from "@/lib/chat/tools/generate-image"
import type {
  AvailableChatAudioReference,
  AvailableChatVideoReference,
} from "@/lib/chat/tools/generate-video"
import { createGenerateVideoTool } from "@/lib/chat/tools/generate-video"
import { createGetBrandContextTool } from "@/lib/chat/tools/get-brand-context"
import { createListInstagramConnectionsTool } from "@/lib/chat/tools/list-instagram-connections"
import { createListSocialConnectionsTool } from "@/lib/chat/tools/list-social-connections"
import { createListRecentGenerationsTool } from "@/lib/chat/tools/list-recent-generations"
import { createSaveGenerationAsAssetTool } from "@/lib/chat/tools/save-generation-as-asset"
import { createPrepareInstagramPostTool } from "@/lib/chat/tools/prepare-instagram-post"
import { createPrepareSocialPostTool } from "@/lib/chat/tools/prepare-social-post"
import { createSearchAssetsTool } from "@/lib/chat/tools/search-assets"
import { createSearchModelsTool } from "@/lib/chat/tools/search-models"
import { createSearchStockReferencesTool } from "@/lib/chat/tools/search-stock-references"
import { createSearchVoicesTool } from "@/lib/chat/tools/search-voices"
import { createActivateSkillTool, createSaveSkillTool } from "@/lib/chat/tools/skills"
import { createExtractVideoFramesTool } from "@/lib/chat/tools/extract-video-frames"
import { createComposeTimelineVideoTool } from "@/lib/chat/tools/compose-timeline-video"
import { createAwaitGenerationTool } from "@/lib/chat/tools/await-generation"
import { createEstimateModelLatencyTool } from "@/lib/chat/tools/estimate-model-latency"
import { createListThreadMediaTool } from "@/lib/chat/tools/list-thread-media"
import { createScheduleGenerationFollowUpTool } from "@/lib/chat/tools/schedule-generation-follow-up"
import { createListAutomationsTool } from "@/lib/chat/tools/list-automations"
import { createManageAutomationTool } from "@/lib/chat/tools/manage-automation"
import {
  createCapturePageScreenshotTool,
  createReadWebPageTool,
  createSearchWebImagesTool,
  createSearchWebTool,
} from "@/lib/chat/tools/web-research"
import type { AttachedRef } from "@/lib/commands/types"

interface CreateCreativeChatToolsOptions {
  availableReferences: AvailableChatImageReference[]
  availableVideoReferences: AvailableChatVideoReference[]
  availableAudioReferences: AvailableChatAudioReference[]
  defaultAutomationRefs?: AttachedRef[]
  defaultAutomationAttachments?: AutomationPromptAttachment[]
  supabase: SupabaseClient
  threadId?: string
  userId: string
  skillsCatalog?: SkillCatalogEntry[]
  /** `resume`: webhook follow-up turn — Instagram draft etc. runs without interactive tool approval. */
  source?: "chat" | "automation" | "resume"
}

export function createCreativeChatTools({
  availableReferences,
  availableVideoReferences,
  availableAudioReferences,
  defaultAutomationRefs = [],
  defaultAutomationAttachments = [],
  supabase,
  threadId,
  userId,
  skillsCatalog = [],
  source = "chat",
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

  const scheduleGenerationFollowUpTool = threadId
    ? createScheduleGenerationFollowUpTool({ supabase, threadId, userId })
    : null

  return {
    ...(listThreadMediaTool ? { listThreadMedia: listThreadMediaTool } : {}),
    ...(composeTimelineVideoTool ? { composeTimelineVideo: composeTimelineVideoTool } : {}),
    ...(scheduleGenerationFollowUpTool
      ? { scheduleGenerationFollowUp: scheduleGenerationFollowUpTool }
      : {}),
    ...(source === "chat"
      ? {
          listAutomations: createListAutomationsTool({
            supabase,
            userId,
          }),
          manageAutomation: createManageAutomationTool({
            defaultRefs: defaultAutomationRefs,
            defaultAttachments: defaultAutomationAttachments,
            supabase,
            userId,
          }),
        }
      : {}),
    listSocialConnections: createListSocialConnectionsTool({
      supabase,
      userId,
    }),
    listInstagramConnections: createListInstagramConnectionsTool({
      supabase,
      userId,
    }),
    prepareSocialPost: createPrepareSocialPostTool({
      supabase,
      userId,
      requireApproval: source === "chat",
    }),
    prepareInstagramPost: createPrepareInstagramPostTool({
      supabase,
      userId,
      requireApproval: source === "chat",
    }),
    generateAudio: createGenerateAudioTool({
      supabase,
      threadId,
      userId,
    }),
    generateImage: createGenerateImageTool({
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
    searchWeb: createSearchWebTool(),
    readWebPage: createReadWebPageTool(),
    searchWebImages: createSearchWebImagesTool(),
    capturePageScreenshot: createCapturePageScreenshotTool({
      supabase,
      threadId,
      userId,
    }),
    searchAssets: createSearchAssetsTool({
      supabase,
      userId,
    }),
    searchStockReferences: createSearchStockReferencesTool(),
    searchModels: createSearchModelsTool({
      supabase,
    }),
    searchVoices: createSearchVoicesTool({
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
