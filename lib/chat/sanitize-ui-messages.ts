import type { UIMessage } from "ai"

type SanitizedMessagesResult = {
  changed: boolean
  messages: UIMessage[]
}

function sanitizeToolErrorPart<T>(part: T, markChanged: () => void): T {
  if (!part || typeof part !== "object") {
    return part
  }

  const candidate = part as Record<string, unknown>
  if (candidate.state !== "output-error" || !("output" in candidate)) {
    return part
  }

  const { output: _ignoredOutput, ...rest } = candidate
  markChanged()
  return rest as T
}

export function sanitizeToolErrorPartsInMessages(messages: UIMessage[]): SanitizedMessagesResult {
  let changed = false

  const sanitizedMessages = messages.map((message) => {
    let messageChanged = false
    const sanitizedParts = message.parts.map((part) =>
      sanitizeToolErrorPart(part, () => {
        changed = true
        messageChanged = true
      }),
    )

    if (!messageChanged) {
      return message
    }

    return {
      ...message,
      parts: sanitizedParts,
    }
  })

  return {
    changed,
    messages: sanitizedMessages,
  }
}
