import type { TemplateInput, TemplatePromptAttachment } from "@/lib/templates/types"

export type SavedExampleSurface = "image" | "video"
export type SavedExampleVisibility = "private" | "public"
export type SavedExampleCoverKind = "image" | "video"

export interface SavedExampleDefaultSettings {
  model?: string | null
  aspect_ratio?: string | null
  num_images?: number | null
  enhance_prompt?: boolean | null
  model_parameters?: Record<string, unknown> | null
  [key: string]: unknown
}

export interface SavedExample {
  id: string
  creator_id: string
  surface: SavedExampleSurface
  title: string
  description: string
  prompt: string
  prompt_attachments: TemplatePromptAttachment[]
  inputs: TemplateInput[]
  default_settings: SavedExampleDefaultSettings
  source_generation_id: string | null
  cover_url: string | null
  cover_kind: SavedExampleCoverKind
  visibility: SavedExampleVisibility
  usage_count: number
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateSavedExampleInput {
  surface: SavedExampleSurface
  title: string
  description?: string
  prompt: string
  prompt_attachments?: TemplatePromptAttachment[]
  inputs?: TemplateInput[]
  default_settings?: SavedExampleDefaultSettings
  source_generation_id?: string | null
  cover_url?: string | null
  cover_kind?: SavedExampleCoverKind
  visibility?: SavedExampleVisibility
}

export interface UpdateSavedExampleInput {
  surface?: SavedExampleSurface
  title?: string
  description?: string
  prompt?: string
  prompt_attachments?: TemplatePromptAttachment[]
  inputs?: TemplateInput[]
  default_settings?: SavedExampleDefaultSettings
  source_generation_id?: string | null
  cover_url?: string | null
  cover_kind?: SavedExampleCoverKind
  visibility?: SavedExampleVisibility
  usage_count?: number
  last_used_at?: string | null
}
