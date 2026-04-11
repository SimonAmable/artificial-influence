import type { AssetType } from "@/lib/assets/types"
import type { AttachedRef } from "@/lib/commands/types"

export type ChatReferenceMetadataItem = {
  assetType?: AssetType
  assetUrl?: string
  category: "brand" | "asset"
  id: string
  label: string
  previewUrl?: string | null
}

export type ChatMessageMetadata = {
  selectedReferences?: ChatReferenceMetadataItem[]
}

export function refsToChatMetadata(refs: AttachedRef[]): ChatMessageMetadata | undefined {
  if (refs.length === 0) return undefined

  return {
    selectedReferences: refs.map((ref) => ({
      assetType: ref.assetType,
      assetUrl: ref.assetUrl,
      category: ref.category,
      id: ref.id,
      label: ref.label,
      previewUrl: ref.previewUrl,
    })),
  }
}

export function getSelectedReferencesFromMessage(message: unknown): ChatReferenceMetadataItem[] {
  if (!message || typeof message !== "object") return []

  const metadata = (message as { metadata?: unknown }).metadata
  if (!metadata || typeof metadata !== "object") return []

  const refs = (metadata as ChatMessageMetadata).selectedReferences
  if (!Array.isArray(refs)) return []

  return refs.filter((ref): ref is ChatReferenceMetadataItem => {
    if (!ref || typeof ref !== "object") return false
    if (ref.category !== "brand" && ref.category !== "asset") return false
    return typeof ref.id === "string" && typeof ref.label === "string"
  })
}
