import assert from "node:assert/strict"
import type { UIMessage } from "ai"

import type { GenerationToolCallSummary } from "./analyze-chat-history-core.ts"

// Inline fallback matching OUTPUT_KIND_CREDIT_HEURISTICS for template tests without path aliases.
function guessCreditsCost(outputKind: "image" | "video" | "audio" | "slideshow" | "mixed"): number {
  const heuristics = { image: 5, slideshow: 20, video: 60, audio: 10, mixed: 80 } as const
  return heuristics[outputKind] ?? 10
}

function thumbnailKindFromMedia(
  media: { kind: "image" | "video" | "audio" | "screenshot" } | null,
): "image" | "video" {
  if (!media) return "image"
  return media.kind === "video" ? "video" : "image"
}

const {
  analyzeChatHistory,
  estimateCreditsFromChatMessages,
  extractGenerationToolCalls,
  extractLastGeneratedMedia,
} = await import(new URL("./analyze-chat-history-core.ts", import.meta.url).href)

function runTest(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

const syncImageMessage: UIMessage = {
  id: "assistant-image",
  role: "assistant",
  parts: [
    {
      type: "tool-generateImage",
      toolCallId: "call-image",
      state: "output-available",
      input: {
        prompt: "portrait",
        modelIdentifier: "openai/gpt-image-2",
      },
      output: {
        status: "completed",
        model: "openai/gpt-image-2",
        creditsUsed: 5,
        images: [{ url: "https://example.com/image-a.png", mimeType: "image/png" }],
      },
    },
  ],
}

const videoMessage: UIMessage = {
  id: "assistant-video",
  role: "assistant",
  parts: [
    {
      type: "tool-generateVideo",
      toolCallId: "call-video",
      state: "output-available",
      input: {
        prompt: "walk cycle",
        modelIdentifier: "kling/kling-3.0",
        duration: 5,
      },
      output: {
        status: "completed",
        model: "kling/kling-3.0",
        creditsQuoted: 60,
        video: { url: "https://example.com/video.mp4", mimeType: "video/mp4" },
      },
    },
  ],
}

const pendingImageMessage: UIMessage = {
  id: "assistant-pending",
  role: "assistant",
  parts: [
    {
      type: "tool-generateImage",
      toolCallId: "call-pending",
      state: "output-available",
      input: {
        prompt: "pending shot",
        modelIdentifier: "openai/gpt-image-2",
      },
      output: {
        status: "pending",
        model: "openai/gpt-image-2",
        generationId: "gen-pending",
      },
    },
  ],
}

const failedMessage: UIMessage = {
  id: "assistant-failed",
  role: "assistant",
  parts: [
    {
      type: "tool-generateImage",
      toolCallId: "call-failed",
      state: "output-available",
      input: {
        prompt: "broken",
        modelIdentifier: "openai/gpt-image-2",
      },
      output: {
        status: "failed",
        model: "openai/gpt-image-2",
      },
    },
  ],
}

const composeMessage: UIMessage = {
  id: "assistant-compose",
  role: "assistant",
  parts: [
    {
      type: "tool-composeTimelineVideo",
      toolCallId: "call-compose",
      state: "output-available",
      input: {},
      output: {
        status: "completed",
        creditsUsed: 2,
        video: { url: "https://example.com/final.mp4", mimeType: "video/mp4" },
      },
    },
  ],
}

runTest("extractLastGeneratedMedia returns newest completed media", () => {
  const messages = [syncImageMessage, videoMessage, composeMessage]
  const media = extractLastGeneratedMedia(messages)

  assert.ok(media)
  assert.equal(media.url, "https://example.com/final.mp4")
  assert.equal(media.kind, "video")
  assert.equal(media.sourceTool, "tool-composeTimelineVideo")
})

runTest("extractGenerationToolCalls counts only successful generations", () => {
  const calls = extractGenerationToolCalls([
    syncImageMessage,
    videoMessage,
    pendingImageMessage,
    failedMessage,
  ])

  assert.equal(calls.length, 4)
  assert.equal(calls.filter((call: GenerationToolCallSummary) => call.succeeded).length, 2)
})

runTest("estimateCreditsFromChatMessages includes creditsQuoted for video", () => {
  const total = estimateCreditsFromChatMessages([syncImageMessage, videoMessage, composeMessage])
  assert.equal(total, 67)
})

runTest("analyzeChatHistory builds model list and breakdown", () => {
  const analysis = analyzeChatHistory([syncImageMessage, videoMessage, composeMessage])

  assert.equal(analysis.successfulGenerationCount, 3)
  assert.deepEqual(analysis.modelsUsed, ["openai/gpt-image-2", "kling/kling-3.0"])
  assert.equal(analysis.creditsTotal, 67)
  assert.equal(analysis.outputKind, "mixed")
  assert.equal(analysis.creditsBreakdown.length, 3)
})

runTest("template-oriented fields derive from chat analysis", () => {
  const analysis = analyzeChatHistory([syncImageMessage, videoMessage])
  const thumbnailUrl = analysis.lastGeneratedMedia?.url ?? null
  const thumbnailKind = thumbnailKindFromMedia(analysis.lastGeneratedMedia)
  const suggestedCreditsCost =
    analysis.creditsTotal > 0 ? analysis.creditsTotal : guessCreditsCost(analysis.outputKind)

  assert.equal(thumbnailUrl, "https://example.com/video.mp4")
  assert.equal(thumbnailKind, "video")
  assert.equal(suggestedCreditsCost, 65)
})

runTest("pending and failed generations do not contribute credits", () => {
  const analysis = analyzeChatHistory([pendingImageMessage, failedMessage])

  assert.equal(analysis.creditsTotal, 0)
  assert.equal(analysis.successfulGenerationCount, 0)
  assert.equal(analysis.lastGeneratedMedia, null)
})
