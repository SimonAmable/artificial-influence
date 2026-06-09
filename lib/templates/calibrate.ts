import type { UIMessage } from "ai"

import { estimateCreditsFromChatMessages } from "@/lib/chat/analyze-chat-history"

/**
 * Sum generation credits from completed tool parts in assistant messages.
 * @deprecated Prefer `estimateCreditsFromChatMessages` from `@/lib/chat/analyze-chat-history`.
 */
export function sumCreditsFromChatMessages(messages: UIMessage[]): number {
  return estimateCreditsFromChatMessages(messages)
}
