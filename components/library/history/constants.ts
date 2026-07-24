import type { GenerationType, HistorySource } from "@/components/library/history/types"

export const HISTORY_PAGE_LIMIT = 24

export const HISTORY_TYPES: GenerationType[] = ["all", "image", "video", "audio"]

export const HISTORY_SOURCES: { value: HistorySource; label: string }[] = [
  { value: "all", label: "All" },
  { value: "generation", label: "Generation" },
  { value: "upload", label: "Upload" },
]

export const HISTORY_TOOLS = [
  { value: "all", label: "All Tools" },
  { value: "image", label: "Image Studio" },
  { value: "video", label: "Video Studio" },
  { value: "lipsync", label: "Lip Sync" },
  { value: "character_swap", label: "Character Swap" },
  { value: "face_swap", label: "Face Swap" },
  { value: "motion_copy", label: "Motion Copy" },
  { value: "ai_influencer", label: "AI Influencer" },
  { value: "carousel_shots", label: "Carousel Shots" },
  { value: "remove-background", label: "Background Remover" },
  { value: "upscale", label: "Upscale" },
  { value: "chat-generation", label: "AI Chat Agent" },
] as const

export const emptyHistoryMessages: Record<GenerationType, string> = {
  all: "No media found.",
  image: "No image media found.",
  video: "No video media found.",
  audio: "No audio media found.",
}
