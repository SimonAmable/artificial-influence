import type { GenerationType } from "@/components/library/history/types"

export const HISTORY_PAGE_LIMIT = 24

export const HISTORY_TYPES: GenerationType[] = ["all", "image", "video", "audio"]

export const HISTORY_TOOLS = [
  { value: "all", label: "All Tools" },
  { value: "image", label: "Image Studio" },
  { value: "video", label: "Video Studio" },
  { value: "lipsync", label: "Lip Sync" },
  { value: "character_swap", label: "Character Swap" },
  { value: "motion_copy", label: "Motion Copy" },
  { value: "ai_influencer", label: "AI Influencer" },
  { value: "remove-background", label: "Background Remover" },
  { value: "upscale", label: "Upscale" },
  { value: "chat-generation", label: "AI Chat Agent" },
] as const

export const emptyHistoryMessages: Record<GenerationType, string> = {
  all: "No generations found.",
  image: "No image generations found.",
  video: "No video generations found.",
  audio: "No audio generations found.",
}
