import type { UIMessage } from "ai"

export type GeneratedMediaKind = "image" | "video" | "audio" | "screenshot"

export type CreditSource = "output" | "quoted" | "unknown"

export type ChatAnalysisOutputKind = "image" | "video" | "audio" | "slideshow" | "mixed"

export const CREDIT_TOOL_TYPES = new Set([
  "tool-generateImage",
  "tool-generateImageWithNanoBanana",
  "tool-generateVideo",
  "tool-generateAudio",
  "tool-upscaleImage",
  "tool-composeTimelineVideo",
])

const MEDIA_TOOL_TYPES = new Set([
  ...CREDIT_TOOL_TYPES,
  "tool-textOverlay",
  "tool-capturePageScreenshot",
])

const GENERATION_TOOL_TYPES = MEDIA_TOOL_TYPES

type ToolPartState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied"

type ToolMessagePart = {
  type: `tool-${string}`
  toolCallId?: string
  state?: ToolPartState
  input?: Record<string, unknown>
  output?: ToolOutput
}

type ToolOutput = {
  status?: "pending" | "completed" | "failed" | "applied" | "preview"
  model?: string
  generationId?: string | null
  creditsUsed?: number
  creditsQuoted?: number
  images?: Array<{
    mimeType?: string
    url: string
    storagePath?: string | null
  }>
  video?: {
    mimeType?: string
    url: string
    storagePath?: string | null
  }
  audio?: {
    mimeType?: string
    url: string
    storagePath?: string | null
  }
  screenshot?: {
    url: string
    storagePath?: string
    mimeType?: string
  }
}

export interface ExtractedMedia {
  kind: GeneratedMediaKind
  url: string
  mimeType?: string
  storagePath?: string | null
  sourceTool: string
  toolCallId: string
  messageId: string
  model?: string
  generationId?: string | null
}

export interface GenerationToolCallSummary {
  toolType: string
  toolCallId: string
  messageId: string
  state: ToolPartState | undefined
  status?: ToolOutput["status"]
  model?: string
  creditsUsed?: number
  creditsQuoted?: number
  creditsEstimated: number
  creditSource: CreditSource
  generationId?: string | null
  succeeded: boolean
}

export interface CreditsBreakdownEntry {
  toolType: string
  model?: string
  credits: number
  creditSource: CreditSource
  toolCallId: string
}

export interface ChatHistoryAnalysis {
  lastGeneratedMedia: ExtractedMedia | null
  generationCalls: GenerationToolCallSummary[]
  successfulGenerationCount: number
  modelsUsed: string[]
  creditsTotal: number
  creditsBreakdown: CreditsBreakdownEntry[]
  outputKind: ChatAnalysisOutputKind
}

function isToolPart(part: UIMessage["parts"][number]): part is ToolMessagePart {
  return typeof part.type === "string" && part.type.startsWith("tool-")
}

function resolveModel(part: ToolMessagePart): string | undefined {
  const outputModel = part.output?.model
  if (typeof outputModel === "string" && outputModel.trim()) {
    return outputModel.trim()
  }

  const inputModel = part.input?.modelIdentifier
  if (typeof inputModel === "string" && inputModel.trim()) {
    return inputModel.trim()
  }

  return undefined
}

function resolveCredits(output: ToolOutput | undefined): {
  credits: number
  creditSource: CreditSource
  creditsUsed?: number
  creditsQuoted?: number
} {
  if (typeof output?.creditsUsed === "number" && output.creditsUsed > 0) {
    return {
      credits: output.creditsUsed,
      creditSource: "output",
      creditsUsed: output.creditsUsed,
      creditsQuoted: output.creditsQuoted,
    }
  }

  if (typeof output?.creditsQuoted === "number" && output.creditsQuoted > 0) {
    return {
      credits: output.creditsQuoted,
      creditSource: "quoted",
      creditsUsed: output.creditsUsed,
      creditsQuoted: output.creditsQuoted,
    }
  }

  return {
    credits: 0,
    creditSource: "unknown",
    creditsUsed: output?.creditsUsed,
    creditsQuoted: output?.creditsQuoted,
  }
}

function hasCompletedMedia(output: ToolOutput | undefined): boolean {
  if (!output) return false

  if (output.images?.some((image) => image.url.trim())) return true
  if (output.video?.url.trim()) return true
  if (output.audio?.url.trim()) return true
  if (output.screenshot?.url.trim()) return true

  return false
}

function isSuccessfulGeneration(part: ToolMessagePart): boolean {
  if (part.state !== "output-available") return false

  const output = part.output
  if (!output) return false
  if (output.status === "failed") return false
  if (output.status === "pending") return false

  return hasCompletedMedia(output) || typeof output.creditsUsed === "number" || typeof output.creditsQuoted === "number"
}

function extractMediaFromPart(
  part: UIMessage["parts"][number],
  messageId: string,
): ExtractedMedia | null {
  if (!isToolPart(part) || !MEDIA_TOOL_TYPES.has(part.type)) return null
  if (part.state !== "output-available") return null

  const output = part.output
  if (!output || output.status === "failed" || output.status === "pending") return null

  const model = resolveModel(part)
  const toolCallId = part.toolCallId ?? ""
  const base = {
    sourceTool: part.type,
    toolCallId,
    messageId,
    model,
    generationId: output.generationId,
  }

  const firstImage = output.images?.find((image) => image.url.trim())
  if (firstImage) {
    return {
      ...base,
      kind: "image",
      url: firstImage.url,
      mimeType: firstImage.mimeType,
      storagePath: firstImage.storagePath,
    }
  }

  if (output.video?.url.trim()) {
    return {
      ...base,
      kind: "video",
      url: output.video.url,
      mimeType: output.video.mimeType,
      storagePath: output.video.storagePath,
    }
  }

  if (output.audio?.url.trim()) {
    return {
      ...base,
      kind: "audio",
      url: output.audio.url,
      mimeType: output.audio.mimeType,
      storagePath: output.audio.storagePath,
    }
  }

  if (output.screenshot?.url.trim()) {
    return {
      ...base,
      kind: "screenshot",
      url: output.screenshot.url,
      storagePath: output.screenshot.storagePath,
    }
  }

  return null
}

/**
 * Walk messages newest-first and return the most recent completed generated media.
 */
export function extractLastGeneratedMedia(messages: UIMessage[]): ExtractedMedia | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex]
    if (message.role !== "assistant") continue

    for (let partIndex = message.parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const media = extractMediaFromPart(message.parts[partIndex], message.id)
      if (media) return media
    }
  }

  return null
}

/**
 * Collect generation-related tool calls from assistant messages.
 */
export function extractGenerationToolCalls(messages: UIMessage[]): GenerationToolCallSummary[] {
  const calls: GenerationToolCallSummary[] = []

  for (const message of messages) {
    if (message.role !== "assistant") continue

    for (const part of message.parts) {
      if (!isToolPart(part) || !GENERATION_TOOL_TYPES.has(part.type)) continue

      const credits = resolveCredits(part.output)
      calls.push({
        toolType: part.type,
        toolCallId: part.toolCallId ?? "",
        messageId: message.id,
        state: part.state,
        status: part.output?.status,
        model: resolveModel(part),
        creditsUsed: credits.creditsUsed,
        creditsQuoted: credits.creditsQuoted,
        creditsEstimated: credits.credits,
        creditSource: credits.creditSource,
        generationId: part.output?.generationId,
        succeeded: isSuccessfulGeneration(part),
      })
    }
  }

  return calls
}

function deriveOutputKind(calls: GenerationToolCallSummary[]): ChatAnalysisOutputKind {
  const succeeded = calls.filter((call) => call.succeeded)
  if (succeeded.length === 0) return "mixed"

  const kinds = new Set<ChatAnalysisOutputKind>()

  for (const call of succeeded) {
    switch (call.toolType) {
      case "tool-generateVideo":
      case "tool-composeTimelineVideo":
      case "tool-textOverlay":
        kinds.add("video")
        break
      case "tool-generateAudio":
        kinds.add("audio")
        break
      case "tool-generateImage":
      case "tool-generateImageWithNanoBanana":
      case "tool-upscaleImage":
      case "tool-capturePageScreenshot":
        kinds.add("image")
        break
      default:
        break
    }
  }

  if (kinds.size === 0) return "mixed"
  if (kinds.size === 1) return [...kinds][0]
  return "mixed"
}

function buildCreditsBreakdown(calls: GenerationToolCallSummary[]): CreditsBreakdownEntry[] {
  return calls
    .filter((call) => call.creditsEstimated > 0)
    .map((call) => ({
      toolType: call.toolType,
      model: call.model,
      credits: call.creditsEstimated,
      creditSource: call.creditSource,
      toolCallId: call.toolCallId,
    }))
}

/**
 * Full chat history analysis: last media, generation calls, models, and credits.
 */
export function analyzeChatHistory(messages: UIMessage[]): ChatHistoryAnalysis {
  const generationCalls = extractGenerationToolCalls(messages)
  const successfulGenerationCount = generationCalls.filter((call) => call.succeeded).length
  const modelsUsed = [
    ...new Set(
      generationCalls
        .filter((call) => call.succeeded && call.model)
        .map((call) => call.model as string),
    ),
  ]
  const creditsBreakdown = buildCreditsBreakdown(generationCalls)
  const creditsTotal = creditsBreakdown.reduce((sum, entry) => sum + entry.credits, 0)

  return {
    lastGeneratedMedia: extractLastGeneratedMedia(messages),
    generationCalls,
    successfulGenerationCount,
    modelsUsed,
    creditsTotal,
    creditsBreakdown,
    outputKind: deriveOutputKind(generationCalls),
  }
}

/**
 * Sum generation credits from chat tool outputs.
 * Uses creditsUsed when present, otherwise creditsQuoted (e.g. video).
 */
export function estimateCreditsFromChatMessages(messages: UIMessage[]): number {
  return analyzeChatHistory(messages).creditsTotal
}
