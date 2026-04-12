import type { SupabaseClient } from "@supabase/supabase-js"
import type { SkillCatalogEntry } from "@/lib/chat/skills/catalog"
import type {
  AvailableChatImageReference,
  ChatImageReference,
} from "@/lib/chat/tools/generate-image-with-nano-banana"
import { createGenerateImageTool } from "@/lib/chat/tools/generate-image"
import { createGenerateImageWithNanoBananaTool } from "@/lib/chat/tools/generate-image-with-nano-banana"
import type { ChatAudioReference, ChatVideoReference } from "@/lib/chat/tools/generate-video"
import { createGenerateVideoTool } from "@/lib/chat/tools/generate-video"
import { createGetBrandContextTool } from "@/lib/chat/tools/get-brand-context"
import { createListRecentGenerationsTool } from "@/lib/chat/tools/list-recent-generations"
import { createSaveGenerationAsAssetTool } from "@/lib/chat/tools/save-generation-as-asset"
import { createSearchAssetsTool } from "@/lib/chat/tools/search-assets"
import { createSearchModelsTool } from "@/lib/chat/tools/search-models"
import { createActivateSkillTool, createSaveSkillTool } from "@/lib/chat/tools/skills"

interface CreateCreativeChatToolsOptions {
  availableReferences: AvailableChatImageReference[]
  latestUserImages: ChatImageReference[]
  latestUserVideos: ChatVideoReference[]
  latestUserAudios: ChatAudioReference[]
  supabase: SupabaseClient
  userId: string
  skillsCatalog?: SkillCatalogEntry[]
}

export function createCreativeChatTools({
  availableReferences,
  latestUserImages,
  latestUserVideos,
  latestUserAudios,
  supabase,
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

  return {
    generateImage: createGenerateImageTool({
      availableReferences,
      latestUserImages,
      supabase,
      userId,
    }),
    generateImageWithNanoBanana: createGenerateImageWithNanoBananaTool({
      availableReferences,
      latestUserImages,
      supabase,
      userId,
    }),
    generateVideo: createGenerateVideoTool({
      availableReferences,
      latestUserImages,
      latestUserVideos,
      latestUserAudios,
      supabase,
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
    saveSkill: createSaveSkillTool({
      supabase,
      userId,
    }),
    ...(activateSkillTool ? { activateSkill: activateSkillTool } : {}),
  }
}
