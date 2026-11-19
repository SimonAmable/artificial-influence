export const VIRAL_CLONER_TOOL = "viral_cloner" as const

export const VIRAL_CLONER_IMAGE_CREDITS = 4
export const VIRAL_CLONER_VIDEO_CREDITS_PER_SECOND = 8
export const VIRAL_CLONER_IMPORT_CREDIT = 1

export const VIRAL_CLONER_QWEN_MODEL = "wavespeed-ai/qwen-image-2.1" as const
export const VIRAL_CLONER_QWEN_RESOLUTION = "1.5k" as const
export const VIRAL_CLONER_CANONICAL_PROMPT_VERSION = 1

export const GENJUTSU_MIN_SECONDS = 2 as const
export const GENJUTSU_MAX_SECONDS = 15 as const

export function readViralClonerQwenLoraPath(): string {
  return (
    process.env.VIRAL_CLONER_QWEN_LORA_PATH?.trim() ||
    "https://huggingface.co/datasets/Lab67/models/resolve/main/bfs_head_v1.1_qwen_2.1.safetensors"
  )
}

export function readViralClonerQwenLoraScale(): number {
  const raw = process.env.VIRAL_CLONER_QWEN_LORA_SCALE?.trim()
  const parsed = raw ? Number.parseFloat(raw) : 1
  return Number.isFinite(parsed) ? parsed : 1
}