export const ASSET_PAGE_LIMIT = 200

export const ASSET_SOURCES = [
  { value: "all", label: "All Sources" },
  { value: "upload", label: "Direct Upload" },
  { value: "image-gen", label: "Image Studio" },
  { value: "video-gen", label: "Video Studio" },
  { value: "audio", label: "Audio Studio" },
  { value: "ai_influencer", label: "AI Influencer" },
  { value: "generation-history", label: "Saved History" },
] as const

export const COLUMN_COUNT_STORAGE_KEY = "unican-assets-column-count"
