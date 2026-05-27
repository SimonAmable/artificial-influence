import type { UIMessage } from "ai"

const CREDIT_TOOL_TYPES = new Set([
  "tool-generateImage",
  "tool-generateImageWithNanoBanana",
  "tool-generateVideo",
  "tool-generateAudio",
  "tool-upscaleImage",
  "tool-composeTimelineVideo",
])

/**
 * Sum creditsUsed from completed tool parts in assistant messages.
 */
export function sumCreditsFromChatMessages(messages: UIMessage[]): number {
  let total = 0

  for (const message of messages) {
    if (message.role !== "assistant") continue

    for (const part of message.parts) {
      if (typeof part.type !== "string" || !CREDIT_TOOL_TYPES.has(part.type)) continue
      if (!("state" in part) || part.state !== "output-available") continue

      const output = "output" in part ? (part.output as { creditsUsed?: number } | undefined) : undefined
      if (typeof output?.creditsUsed === "number" && output.creditsUsed > 0) {
        total += output.creditsUsed
      }
    }
  }

  return total
}
