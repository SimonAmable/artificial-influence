import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  AvailableChatImageReference,
  ChatImageReference,
} from "@/lib/chat/tools/generate-image-with-nano-banana"
import { createGenerateImageTool } from "@/lib/chat/tools/generate-image"
import { createGenerateImageWithNanoBananaTool } from "@/lib/chat/tools/generate-image-with-nano-banana"
import type { ChatVideoReference } from "@/lib/chat/tools/generate-video"
import { createGenerateVideoTool } from "@/lib/chat/tools/generate-video"
import { createGetBrandContextTool } from "@/lib/chat/tools/get-brand-context"
import { createListRecentGenerationsTool } from "@/lib/chat/tools/list-recent-generations"
import { createSaveGenerationAsAssetTool } from "@/lib/chat/tools/save-generation-as-asset"
import { createSearchAssetsTool } from "@/lib/chat/tools/search-assets"
import { createSearchModelsTool } from "@/lib/chat/tools/search-models"

interface CreateCreativeChatToolsOptions {
  availableReferences: AvailableChatImageReference[]
  latestUserImages: ChatImageReference[]
  latestUserVideos: ChatVideoReference[]
  supabase: SupabaseClient
  userId: string
}

export function createCreativeChatTools({
  availableReferences,
  latestUserImages,
  latestUserVideos,
  supabase,
  userId,
}: CreateCreativeChatToolsOptions) {
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
  }
}
