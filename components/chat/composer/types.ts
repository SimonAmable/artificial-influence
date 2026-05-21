import type { AttachedRef } from "@/lib/commands/types"

export type ComposerUploadAttachment = {
  file: File
  id: string
  isUploading: boolean
  source: "upload"
  uploadedUrl?: string
}

export type ComposerAssetAttachment = {
  assetType: "image" | "video" | "audio"
  id: string
  ref: AttachedRef
  source: "asset"
  title: string
  url: string
}

export type ComposerAttachment = ComposerUploadAttachment | ComposerAssetAttachment

export type PinnedSkillSummary = {
  slug: string
  title: string | null
  description: string
}
