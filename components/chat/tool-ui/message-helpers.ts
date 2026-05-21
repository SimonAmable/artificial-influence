import type { UIMessage } from "ai"

type ReasoningMessagePart = Extract<UIMessage["parts"][number], { type: "reasoning" }>

export function humanizeToolPartType(toolType: string): string {
  const id = toolType.startsWith("tool-") ? toolType.slice(5) : toolType
  const spaced = id.replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim()
  if (!spaced) return "Tool"
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function truncateMiddle(value: string, maxChars: number) {
  if (value.length <= maxChars) return value
  const head = Math.max(8, Math.floor(maxChars / 2) - 1)
  const tail = maxChars - head - 1
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

export function inferSocialUrlLabel(url: string | undefined): "Instagram" | "TikTok" | "post" {
  const lower = (url ?? "").toLowerCase()
  if (lower.includes("instagram.com")) return "Instagram"
  if (lower.includes("tiktok.com")) return "TikTok"
  return "post"
}

export function collectConsecutiveReasoningParts(
  parts: UIMessage["parts"],
  startIndex: number,
): ReasoningMessagePart[] {
  const reasoningParts: ReasoningMessagePart[] = []

  for (let index = startIndex; index < parts.length; index += 1) {
    const part = parts[index]

    if (part.type !== "reasoning") {
      break
    }

    reasoningParts.push(part)
  }

  return reasoningParts
}
