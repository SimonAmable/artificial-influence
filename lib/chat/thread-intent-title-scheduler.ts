import { waitUntil } from "@vercel/functions"
import type { UIMessage } from "ai"

import { createClient } from "@/lib/supabase/server"

import {
  applyIntentGeneratedThreadTitle,
  claimIntentTitleGenerationSlot,
  generateIntentThreadTitleFromUserOpening,
  plaintextFromFirstUserMessageForIntentTitle,
} from "@/lib/chat/thread-intent-title"

/** Fire-and-forget intent title generation; CAS ensures one model call per thread. */
export function scheduleThreadIntentTitleJob(options: {
  threadId: string
  userId: string
  threadSource?: string | null
  /** Frozen from request start (DB messages empty before this turn). */
  isOpeningTurn: boolean
  onboardingHandoff?: boolean
  /** First user UI message captured when validation ran (opening turn only). */
  openingUserMessage: UIMessage | undefined
}): void {
  const {
    threadId,
    userId,
    threadSource,
    isOpeningTurn,
    onboardingHandoff,
    openingUserMessage,
  } = options

  if (!isOpeningTurn) {
    return
  }
  if (threadSource === "automation") {
    return
  }
  if (onboardingHandoff === true) {
    return
  }

  const openingPlaintext = plaintextFromFirstUserMessageForIntentTitle(openingUserMessage)
  if (!openingPlaintext?.trim()) {
    return
  }

  waitUntil(
    (async () => {
      const supabase = await createClient()
      const claimed = await claimIntentTitleGenerationSlot(supabase, threadId, userId)
      if (!claimed) {
        return
      }

      try {
        const title = await generateIntentThreadTitleFromUserOpening(openingPlaintext)
        if (!title) {
          return
        }

        await applyIntentGeneratedThreadTitle(supabase, threadId, userId, title)
      } catch (e) {
        console.error("[thread-intent-title] background job failed:", e)
      }
    })(),
  )
}
