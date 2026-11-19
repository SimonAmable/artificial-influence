import type { SocialPlatform } from "@/lib/social-imports/types"

export type ViralClonerTrimSelection = {
  startSeconds: number
  endSeconds: number
}

export type ViralCloneMetadata = {
  viralClone: {
    jobId: string
    itemIndex: number
    socialImportId: string
    sourcePlatform: SocialPlatform
    sourceUrl: string
    canonicalPromptVersion: number
  }
}

export type ViralCloneJobStatus =
  | "awaiting_confirmation"
  | "importing"
  | "submitting"
  | "processing"
  | "completed"
  | "partial"
  | "failed"

export type ViralCloneItemStatus =
  | "pending"
  | "importing"
  | "queued"
  | "generating"
  | "completed"
  | "failed"