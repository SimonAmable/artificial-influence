export type AssetVisibility = "private" | "public"

export type AssetCategory =
  | "character"
  | "scene"
  | "shorts"
  | "element"

export type AssetType = "image" | "video" | "audio"

export interface AssetRecord {
  id: string
  userId: string
  uploadId?: string | null
  title: string
  /** Detailed agent-facing context (maintained in the create/edit asset modal only; used for search/tools, not shown in the library grid). */
  description?: string | null
  assetType: AssetType
  category: AssetCategory
  visibility: AssetVisibility
  tags: string[]
  url: string
  thumbnailUrl?: string | null
  createdAt: string
  updatedAt: string
  sourceNodeType?: string | null
  sourceGenerationId?: string | null
  /** Runtime voice id for Audio Studio (`private:{uuid}` or catalog id). */
  voiceId?: string | null
  voiceProvider?: string | null
  /** Attached private voice profile (`private_audio_voices.id`) when kind is private. */
  privateVoiceId?: string | null
  privateVoiceName?: string | null
  privateVoicePreviewUrl?: string | null
  privateVoiceProvider?: string | null
}

export interface CreateAssetInput {
  title: string
  /** Rich notes for the creative agent (modal-only UX; persists on the asset). */
  description?: string | null
  assetType: AssetType
  category: AssetCategory
  visibility: AssetVisibility
  tags?: string[]
  url: string
  uploadId?: string
  supabaseStoragePath?: string
  thumbnailUrl?: string
  sourceNodeType?: string
  sourceGenerationId?: string
  /** Optional private voice to attach (validated as owned by the current user). */
  privateVoiceId?: string | null
  /** Optional catalog/default or private runtime voice id. */
  voiceId?: string | null
  voiceProvider?: string | null
}

export interface AssetVoiceAttachmentInput {
  voiceId: string | null
  voiceProvider: string | null
  privateVoiceId?: string | null
}
