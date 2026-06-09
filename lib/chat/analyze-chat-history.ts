import type { UIMessage } from "ai"

import type { OutputKind, ThumbnailKind } from "@/lib/templates/types"
import { guessCreditsCost } from "@/lib/templates/types"

export {
  analyzeChatHistory,
  CREDIT_TOOL_TYPES,
  estimateCreditsFromChatMessages,
  extractGenerationToolCalls,
  extractLastGeneratedMedia,
} from "./analyze-chat-history-core"

export type {
  ChatAnalysisOutputKind,
  ChatHistoryAnalysis,
  CreditSource,
  CreditsBreakdownEntry,
  ExtractedMedia,
  GeneratedMediaKind,
  GenerationToolCallSummary,
} from "./analyze-chat-history-core"

import {
  analyzeChatHistory,
  type ChatHistoryAnalysis,
  type ExtractedMedia,
} from "./analyze-chat-history-core"

export interface TemplateChatHistoryAnalysis extends ChatHistoryAnalysis {
  thumbnailUrl: string | null
  thumbnailKind: ThumbnailKind
  suggestedCreditsCost: number
  outputKind: OutputKind
}

function thumbnailKindFromMedia(media: ExtractedMedia | null): ThumbnailKind {
  if (!media) return "image"
  return media.kind === "video" ? "video" : "image"
}

/**
 * Template-oriented view of chat history analysis.
 */
export function analyzeChatHistoryForTemplate(messages: UIMessage[]): TemplateChatHistoryAnalysis {
  const analysis = analyzeChatHistory(messages)

  return {
    ...analysis,
    thumbnailUrl: analysis.lastGeneratedMedia?.url ?? null,
    thumbnailKind: thumbnailKindFromMedia(analysis.lastGeneratedMedia),
    suggestedCreditsCost:
      analysis.creditsTotal > 0 ? analysis.creditsTotal : guessCreditsCost(analysis.outputKind),
  }
}
