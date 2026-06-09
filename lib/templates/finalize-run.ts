import type { UIMessage } from "ai"
import { analyzeChatHistoryForTemplate } from "@/lib/chat/analyze-chat-history"
import {
  calibrateTemplateCreditsIfNeeded,
  completeTemplateRun,
  getTemplateRunByThreadId,
} from "@/lib/templates/database-server"

/**
 * After a chat turn completes, update template_runs and calibrate template credits if applicable.
 */
export async function finalizeTemplateRunFromChat(
  threadId: string,
  messages: UIMessage[],
): Promise<void> {
  const run = await getTemplateRunByThreadId(threadId)
  if (!run || !run.template) return

  const { creditsTotal: creditsActual } = analyzeChatHistoryForTemplate(messages)
  const status = creditsActual > 0 || messages.some((m) => m.role === "assistant") ? "complete" : "failed"

  await completeTemplateRun(threadId, status, creditsActual > 0 ? creditsActual : null)

  if (status === "complete" && creditsActual > 0) {
    await calibrateTemplateCreditsIfNeeded(
      run.template_id,
      creditsActual,
      run.template.credits_cost_locked,
    )
  }
}
