export type OutputKind = "image" | "video" | "audio" | "slideshow" | "mixed"

export type TemplateCategory = "photo" | "video" | "slideshow"
export type TemplateVisibility = "private" | "public"
export type TemplateRunStatus = "pending" | "complete" | "failed"
export type ThumbnailKind = "image" | "video"

export type TemplateInputKind = "image" | "video" | "audio" | "text" | "boolean" | "aspect_ratio"

export type AspectRatioPreset = "auto" | "9:16" | "1:1" | "16:9"

export interface TemplatePromptAttachment {
  url: string
  title?: string | null
}

export interface TemplateContextFieldSummary {
  id: string
  kind: TemplateInputKind
  label: string
  value: string
}

export interface TemplateHiddenContext {
  templateTitle: string
  templateSlug: string
  outputKind: OutputKind
  rawPrompt: string
  filledPrompt: string
  fieldSummaries: TemplateContextFieldSummary[]
  imageUrls: string[]
  videoUrls: string[]
  audioUrls: string[]
}

export type TemplateInput =
  | {
      kind: "image"
      id: string
      label: string
      required: boolean
      helpText?: string
    }
  | {
      kind: "video"
      id: string
      label: string
      required: boolean
      helpText?: string
    }
  | {
      kind: "audio"
      id: string
      label: string
      required: boolean
      helpText?: string
    }
  | {
      kind: "text"
      id: string
      label: string
      required: boolean
      placeholder?: string
      multiline?: boolean
    }
  | {
      kind: "boolean"
      id: string
      label: string
      required: boolean
      default?: boolean
    }
  | {
      kind: "aspect_ratio"
      id: string
      label: string
      required: boolean
      default?: AspectRatioPreset
    }

export interface Template {
  id: string
  creator_id: string
  slug: string
  title: string
  description: string
  tips: string | null
  thumbnail_url: string | null
  thumbnail_kind: ThumbnailKind
  category: TemplateCategory
  prompt: string
  prompt_attachments: TemplatePromptAttachment[]
  output_kind: OutputKind
  inputs: TemplateInput[]
  credits_cost: number
  credits_cost_locked: boolean
  last_run_credits: number | null
  run_count: number
  visibility: TemplateVisibility
  created_at: string
  updated_at: string
}

export interface TemplateRun {
  id: string
  template_id: string
  thread_id: string | null
  user_id: string
  input_values: Record<string, unknown>
  template_context: TemplateHiddenContext | null
  started_at: string
  completed_at: string | null
  status: TemplateRunStatus
  credits_estimated: number
  credits_actual: number | null
}

export interface CreateTemplateInput {
  slug: string
  title: string
  description?: string
  tips?: string | null
  thumbnail_url?: string | null
  thumbnail_kind?: ThumbnailKind
  category: TemplateCategory
  prompt: string
  prompt_attachments?: TemplatePromptAttachment[]
  output_kind: OutputKind
  inputs: TemplateInput[]
  credits_cost?: number
  visibility?: TemplateVisibility
}

export interface UpdateTemplateInput {
  slug?: string
  title?: string
  description?: string
  tips?: string | null
  thumbnail_url?: string | null
  thumbnail_kind?: ThumbnailKind
  category?: TemplateCategory
  prompt?: string
  prompt_attachments?: TemplatePromptAttachment[]
  output_kind?: OutputKind
  inputs?: TemplateInput[]
  credits_cost?: number
  credits_cost_locked?: boolean
  visibility?: TemplateVisibility
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "photo",
  "video",
  "slideshow",
]

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  photo: "Photo",
  video: "Video",
  slideshow: "Slideshows",
}

export const OUTPUT_KIND_LABELS: Record<OutputKind, string> = {
  image: "Photo",
  video: "Video",
  audio: "Audio",
  slideshow: "Slideshow",
  mixed: "Mixed",
}

export const OUTPUT_KIND_CREDIT_HEURISTICS: Record<OutputKind, number> = {
  image: 5,
  slideshow: 20,
  video: 60,
  audio: 10,
  mixed: 80,
}

export function guessCreditsCost(outputKind: OutputKind): number {
  return OUTPUT_KIND_CREDIT_HEURISTICS[outputKind] ?? 10
}

export function buildTemplateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "template"
  )
}
