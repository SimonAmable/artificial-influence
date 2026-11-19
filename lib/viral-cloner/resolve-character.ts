import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export async function resolveViralClonerCharacterReference(input: {
  supabase: SupabaseClient
  userId: string
  characterAssetId: string | null
  characterStoragePath: string | null
}): Promise<{ referenceImageUrl: string; referenceStoragePath: string | null; characterAssetId: string | null }> {
  if (input.characterAssetId) {
    const { data, error } = await input.supabase
      .from("assets")
      .select("id, user_id, asset_url, supabase_storage_path")
      .eq("id", input.characterAssetId)
      .eq("user_id", input.userId)
      .eq("category", "character")
      .maybeSingle()

    if (error || !data?.asset_url) {
      throw new Error("Character asset not found.")
    }

    return {
      referenceImageUrl: String(data.asset_url),
      referenceStoragePath:
        typeof data.supabase_storage_path === "string" ? data.supabase_storage_path : null,
      characterAssetId: data.id as string,
    }
  }

  if (input.characterStoragePath) {
    const { data } = input.supabase.storage.from("public-bucket").getPublicUrl(input.characterStoragePath)
    if (!data?.publicUrl) {
      throw new Error("Character image is missing.")
    }
    return {
      referenceImageUrl: data.publicUrl,
      referenceStoragePath: input.characterStoragePath,
      characterAssetId: null,
    }
  }

  throw new Error("Choose a reference character.")
}