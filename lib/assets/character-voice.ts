import type { AssetRecord } from "@/lib/assets/types"
import { saveAsset, setAssetVoice } from "@/lib/assets/library"

export type CharacterAssetLink = Pick<
  AssetRecord,
  | "id"
  | "title"
  | "url"
  | "sourceGenerationId"
  | "voiceId"
  | "voiceProvider"
  | "privateVoiceId"
  | "privateVoiceName"
  | "privateVoicePreviewUrl"
  | "privateVoiceProvider"
>

export function findCharacterAssetForGeneration(
  assets: CharacterAssetLink[],
  generation: { id: string; url: string },
): CharacterAssetLink | null {
  const byGeneration = assets.find(
    (asset) => asset.sourceGenerationId && asset.sourceGenerationId === generation.id,
  )
  if (byGeneration) return byGeneration

  const byUrl = assets.find((asset) => asset.url === generation.url)
  return byUrl ?? null
}

export async function ensureCharacterAsset(input: {
  title: string
  url: string
  sourceGenerationId: string
  description?: string | null
  tags?: string[]
  model?: string | null
}): Promise<AssetRecord> {
  const listResponse = await fetch(`/api/assets?category=character&limit=100`)
  if (!listResponse.ok) {
    throw new Error("Failed to load character assets")
  }
  const listPayload = (await listResponse.json()) as { assets?: AssetRecord[] }
  const assets = Array.isArray(listPayload.assets) ? listPayload.assets : []
  const existing = findCharacterAssetForGeneration(assets, {
    id: input.sourceGenerationId,
    url: input.url,
  })
  if (existing) {
    return existing as AssetRecord
  }

  return saveAsset({
    title: input.title,
    url: input.url,
    assetType: "image",
    category: "character",
    visibility: "private",
    tags: input.tags ?? [],
    description: input.description ?? null,
    sourceNodeType: "ai_influencer",
    sourceGenerationId: input.sourceGenerationId,
  })
}

export async function attachVoiceToCharacter(input: {
  assetId?: string | null
  title: string
  url: string
  sourceGenerationId: string
  voiceId: string | null
  voiceProvider: string | null
  privateVoiceId?: string | null
  description?: string | null
  tags?: string[]
  model?: string | null
}): Promise<AssetRecord> {
  if (input.assetId) {
    return setAssetVoice(input.assetId, {
      voiceId: input.voiceId,
      voiceProvider: input.voiceProvider,
      privateVoiceId: input.privateVoiceId ?? null,
    })
  }

  const listResponse = await fetch(`/api/assets?category=character&limit=100`)
  if (!listResponse.ok) {
    throw new Error("Failed to load character assets")
  }
  const listPayload = (await listResponse.json()) as { assets?: AssetRecord[] }
  const assets = Array.isArray(listPayload.assets) ? listPayload.assets : []
  const existing = findCharacterAssetForGeneration(assets, {
    id: input.sourceGenerationId,
    url: input.url,
  })

  if (existing) {
    return setAssetVoice(existing.id, {
      voiceId: input.voiceId,
      voiceProvider: input.voiceProvider,
      privateVoiceId: input.privateVoiceId ?? null,
    })
  }

  return saveAsset({
    title: input.title,
    url: input.url,
    assetType: "image",
    category: "character",
    visibility: "private",
    tags: input.tags ?? [],
    description: input.description ?? null,
    sourceNodeType: "ai_influencer",
    sourceGenerationId: input.sourceGenerationId,
    voiceId: input.voiceId,
    voiceProvider: input.voiceProvider,
    privateVoiceId: input.privateVoiceId ?? null,
  })
}

/** @deprecated Prefer attachVoiceToCharacter */
export async function attachPrivateVoiceToCharacter(input: {
  title: string
  url: string
  sourceGenerationId: string
  privateVoiceId: string | null
  description?: string | null
  tags?: string[]
  model?: string | null
}): Promise<AssetRecord> {
  return attachVoiceToCharacter({
    ...input,
    voiceId: input.privateVoiceId ? `private:${input.privateVoiceId}` : null,
    voiceProvider: input.privateVoiceId ? "qwen" : null,
    privateVoiceId: input.privateVoiceId,
  })
}
