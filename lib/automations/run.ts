import {
  createAgentUIStream,
  createIdGenerator,
  InferAgentUIMessage,
  TypeValidationError,
  validateUIMessages,
  type UIMessage,
} from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  buildAutomationUserMessage,
  normalizeAutomationPromptPayload,
} from "@/lib/automations/prompt-payload"
import { bindPendingGenerationsToChatMessages } from "@/lib/chat/media-persistence"
import { replaceChatThreadMessages } from "@/lib/chat/database-server"
import { createCreativeAgent } from "@/lib/chat/creative-agent"
import {
  getAvailableConversationAudioReferences,
  getAvailableConversationImageReferences,
  getAvailableConversationVideoReferences,
} from "@/lib/chat/conversation-references"
import { loadSkillsCatalog } from "@/lib/chat/skills/catalog"
import { sanitizeToolErrorPartsInMessages } from "@/lib/chat/sanitize-ui-messages"
import { buildSelectedReferenceContext } from "@/lib/chat/selected-reference-context"
import { registerThreadMediaFromUserMessageParts } from "@/lib/chat/thread-media/server"
import { createCreativeChatTools } from "@/lib/chat/tools"
import { resolveChatGatewayModel } from "@/lib/constants/chat-llm-models"
import { captureAutomationPreview } from "@/lib/automations/preview"
import type { AutomationRow, AutomationRunTrigger } from "@/lib/automations/types"

export type RunAutomationOptions = {
  trigger: AutomationRunTrigger
}

function truncateError(error: unknown): string {
  const s = error instanceof Error ? error.message : String(error)
  return s.length > 500 ? s.slice(0, 500) : s
}

export type RunAutomationResult =
  | { ok: true; threadId: string; runId: string }
  | { ok: false; error: string; runId?: string }

/**
 * Executes the creative agent for an automation: creates a new chat thread (source=automation),
 * runs the tool loop, persists messages. Caller is responsible for claiming `next_run_at` when using cron.
 */
export async function runAutomation(
  admin: SupabaseClient,
  automation: AutomationRow,
  options: RunAutomationOptions,
): Promise<RunAutomationResult> {
  const { trigger } = options
  const userId = automation.user_id
  const model = resolveChatGatewayModel(automation.model ?? undefined)
  const genId = createIdGenerator({ prefix: "msg", size: 16 })

  const title = `${automation.name} — ${new Date().toISOString()}`

  const { data: threadRow, error: threadError } = await admin
    .from("chat_threads")
    .insert({
      user_id: userId,
      title,
      messages: [],
      source: "automation",
      automation_id: automation.id,
      automation_trigger: trigger,
    })
    .select("id")
    .single()

  if (threadError || !threadRow?.id) {
    console.error("[automations/run] chat_threads insert failed:", threadError)
    return { ok: false, error: threadError?.message ?? "Failed to create chat thread" }
  }

  const threadId = threadRow.id as string

  const { data: runRow, error: runInsertError } = await admin
    .from("automation_runs")
    .insert({
      automation_id: automation.id,
      user_id: userId,
      thread_id: threadId,
      status: "running",
      run_trigger: trigger,
    })
    .select("id")
    .single()

  if (runInsertError || !runRow?.id) {
    console.error("[automations/run] automation_runs insert failed:", runInsertError)
    return { ok: false, error: runInsertError?.message ?? "Failed to create run record", runId: undefined }
  }

  const runId = runRow.id as string

  const promptPayload = normalizeAutomationPromptPayload(
    automation.prompt,
    automation.prompt_payload,
  )
  const userMessage = buildAutomationUserMessage(promptPayload, genId)

  const sanitized = sanitizeToolErrorPartsInMessages([userMessage])
  const requestMessages = sanitized.messages

  const skillsCatalog = await loadSkillsCatalog(admin, userId)

  const validationTools = createCreativeChatTools({
    availableReferences: [],
    availableVideoReferences: [],
    availableAudioReferences: [],
    supabase: admin,
    threadId,
    userId,
    skillsCatalog,
    source: "automation",
  }) as NonNullable<Parameters<typeof validateUIMessages>[0]["tools"]>

  let validatedMessages: UIMessage[]
  try {
    validatedMessages = await validateUIMessages({
      messages: requestMessages,
      tools: validationTools,
    })
  } catch (validationError) {
    const errMsg =
      validationError instanceof TypeValidationError
        ? "Message validation failed for automation prompt."
        : validationError instanceof Error
          ? validationError.message
          : "Validation failed"
    await finishRunFailed(admin, automation, runId, errMsg)
    return { ok: false, error: errMsg, runId }
  }

  const lastUser = [...validatedMessages].reverse().find((m) => m.role === "user")
  if (lastUser) {
    try {
      await registerThreadMediaFromUserMessageParts(admin, userId, threadId, lastUser.parts)
    } catch (registerError) {
      console.error("[automations/run] Thread media registration failed:", registerError)
    }
  }

  let selectedReferenceContext = ""
  try {
    selectedReferenceContext = await buildSelectedReferenceContext(admin, userId, validatedMessages)
  } catch (refErr) {
    const errMsg = truncateError(refErr)
    await finishRunFailed(admin, automation, runId, errMsg)
    return { ok: false, error: errMsg, runId }
  }

  const creativeAgent = createCreativeAgent({
    availableReferences: getAvailableConversationImageReferences(validatedMessages),
    availableVideoReferences: getAvailableConversationVideoReferences(validatedMessages),
    availableAudioReferences: getAvailableConversationAudioReferences(validatedMessages),
    model,
    selectedReferenceContext: selectedReferenceContext || undefined,
    skillsCatalog,
    supabase: admin,
    threadId,
    userId,
    source: "automation",
  })
  type CreativeAgentUIMessage = InferAgentUIMessage<typeof creativeAgent>
  const creativeAgentMessages = validatedMessages as CreativeAgentUIMessage[]

  try {
    const uiStream = await createAgentUIStream({
      agent: creativeAgent,
      uiMessages: creativeAgentMessages,
      originalMessages: creativeAgentMessages,
      generateMessageId: genId,
      onFinish: async ({ messages: responseMessages, isAborted }) => {
        if (isAborted || !threadId) {
          return
        }
        try {
          await replaceChatThreadMessages(admin, threadId, userId, responseMessages as UIMessage[])
          await bindPendingGenerationsToChatMessages({
            messages: responseMessages as UIMessage[],
            supabase: admin,
            threadId,
            userId,
          })
          if (automation.is_public === true) {
            await captureAutomationPreview(admin, automation.id, runId, responseMessages as UIMessage[])
          }
        } catch (persistError) {
          console.error("[automations/run] persist failed:", persistError)
        }
      },
    })

    for await (const _chunk of uiStream) {
      void _chunk
      // drain UI stream so onFinish runs
    }
  } catch (runError) {
    const errMsg = truncateError(runError)
    await finishRunFailed(admin, automation, runId, errMsg)
    return { ok: false, error: errMsg, runId }
  }

  const nowIso = new Date().toISOString()

  await admin
    .from("automation_runs")
    .update({
      status: "completed",
      finished_at: nowIso,
      error: null,
    })
    .eq("id", runId)

  await admin
    .from("automations")
    .update({
      last_run_at: nowIso,
      run_count: automation.run_count + 1,
      last_error: null,
      updated_at: nowIso,
    })
    .eq("id", automation.id)

  return { ok: true, threadId, runId }
}

async function finishRunFailed(
  admin: SupabaseClient,
  automation: AutomationRow,
  runId: string,
  errMsg: string,
) {
  const nowIso = new Date().toISOString()

  await admin
    .from("automation_runs")
    .update({
      status: "failed",
      finished_at: nowIso,
      error: errMsg,
    })
    .eq("id", runId)

  await admin
    .from("automations")
    .update({
      last_error: errMsg,
      updated_at: nowIso,
    })
    .eq("id", automation.id)
}
