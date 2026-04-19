import {
  consumeStream,
  createAgentUIStream,
  createIdGenerator,
  validateUIMessages,
  TypeValidationError,
  type InferAgentUIMessage,
  type UIMessage,
} from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { loadChatThreadMessagesForServiceRole, replaceChatThreadMessages } from "@/lib/chat/database-server"
import { bindPendingGenerationsToChatMessages } from "@/lib/chat/media-persistence"
import { sanitizeToolErrorPartsInMessages } from "@/lib/chat/sanitize-ui-messages"
import { createCreativeAgent } from "@/lib/chat/creative-agent"
import { createCreativeChatTools } from "@/lib/chat/tools"
import {
  getAvailableConversationAudioReferences,
  getAvailableConversationImageReferences,
  getAvailableConversationVideoReferences,
} from "@/lib/chat/conversation-references"
import { buildSelectedReferenceContext } from "@/lib/chat/selected-reference-context"
import { DEFAULT_CHAT_GATEWAY_MODEL } from "@/lib/constants/chat-llm-models"
import { formatGenerationMediaId } from "@/lib/chat/media-id"

function buildContinuationUserMessageText(options: {
  plan: string
  mediaId: string
  publicUrl: string
  kind: "image" | "video"
  generationId: string
}): string {
  return [
    "[Automatic follow-up: the scheduled generation finished. Execute the user's plan using tools. Do not ask the user to wait.]",
    `Generation id: ${options.generationId}`,
    `Media id for tools (referenceIds / mediaUrl): ${options.mediaId}`,
    `Public URL: ${options.publicUrl}`,
    `Kind: ${options.kind}`,
    "",
    "Plan to execute now:",
    options.plan.trim(),
  ].join("\n")
}

/**
 * Runs one agent turn after a generation completes (called from the Replicate webhook).
 * Claims the follow-up row, appends a synthetic user message, streams the agent, persists messages.
 */
export async function runGenerationFollowUpResume(options: {
  supabase: SupabaseClient
  generationId: string
}): Promise<{ skipped: boolean; error?: string }> {
  const { supabase, generationId } = options

  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error("[generation-follow-up-resume] AI_GATEWAY_API_KEY not set")
    return { skipped: true, error: "AI_GATEWAY_API_KEY not set" }
  }

  const { data: claimed, error: claimError } = await supabase
    .from("generation_follow_ups")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("generation_id", generationId)
    .eq("status", "pending")
    .select("id, user_id, thread_id, plan")
    .maybeSingle()

  if (claimError) {
    console.error("[generation-follow-up-resume] claim failed:", claimError.message)
    return { skipped: true, error: claimError.message }
  }

  if (!claimed) {
    return { skipped: true }
  }

  const row = claimed as { id: string; user_id: string; thread_id: string; plan: string }

  const failRow = async (message: string) => {
    await supabase
      .from("generation_follow_ups")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
  }

  try {
    const { data: gen, error: genError } = await supabase
      .from("generations")
      .select("id, type, status, supabase_storage_path, user_id")
      .eq("id", generationId)
      .eq("user_id", row.user_id)
      .maybeSingle()

    if (genError || !gen || gen.status !== "completed" || !gen.supabase_storage_path) {
      const msg = genError?.message ?? "Generation not ready for follow-up"
      await failRow(msg)
      return { skipped: true, error: msg }
    }

    const { data: urlData } = supabase.storage
      .from("public-bucket")
      .getPublicUrl(gen.supabase_storage_path)
    const publicUrl = urlData.publicUrl
    const mediaId = formatGenerationMediaId(gen.id)
    const kind = gen.type as "image" | "video"

    const loaded = await loadChatThreadMessagesForServiceRole(supabase, row.thread_id, row.user_id)
    const sanitized = sanitizeToolErrorPartsInMessages(loaded)

    const generateMessageId = createIdGenerator({ prefix: "msg", size: 16 })
    const continuation: UIMessage = {
      id: generateMessageId(),
      role: "user",
      parts: [
        {
          type: "text",
          text: buildContinuationUserMessageText({
            plan: row.plan,
            mediaId,
            publicUrl,
            kind,
            generationId: gen.id,
          }),
        },
      ],
    }

    const requestMessages = [...sanitized.messages, continuation]

    const validationTools = createCreativeChatTools({
      availableReferences: [],
      availableVideoReferences: [],
      availableAudioReferences: [],
      supabase,
      threadId: row.thread_id,
      userId: row.user_id,
      skillsCatalog: [],
      source: "resume",
    }) as NonNullable<Parameters<typeof validateUIMessages>[0]["tools"]>

    let validatedMessages: UIMessage[]

    try {
      validatedMessages = await validateUIMessages({
        messages: requestMessages,
        tools: validationTools,
      })
    } catch (validationError) {
      if (validationError instanceof TypeValidationError) {
        console.error("[generation-follow-up-resume] Message validation failed:", validationError)
        await failRow("Stored chat messages no longer match the current tool schema.")
        return { skipped: false, error: "validation failed" }
      }
      throw validationError
    }

    const selectedReferenceContext = await buildSelectedReferenceContext(
      supabase,
      row.user_id,
      validatedMessages,
    )

    const creativeAgent = createCreativeAgent({
      availableReferences: getAvailableConversationImageReferences(validatedMessages),
      availableVideoReferences: getAvailableConversationVideoReferences(validatedMessages),
      availableAudioReferences: getAvailableConversationAudioReferences(validatedMessages),
      model: DEFAULT_CHAT_GATEWAY_MODEL,
      selectedReferenceContext,
      skillsCatalog: [],
      supabase,
      threadId: row.thread_id,
      userId: row.user_id,
      source: "resume",
    })

    type CreativeAgentUIMessage = InferAgentUIMessage<typeof creativeAgent>
    const creativeAgentMessages = validatedMessages as CreativeAgentUIMessage[]

    const stream = await createAgentUIStream({
      agent: creativeAgent,
      uiMessages: creativeAgentMessages,
      originalMessages: creativeAgentMessages,
      generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
      onFinish: async ({ messages: responseMessages, isAborted }) => {
        if (isAborted) {
          return
        }
        try {
          await replaceChatThreadMessages(
            supabase,
            row.thread_id,
            row.user_id,
            responseMessages as UIMessage[],
          )
          await bindPendingGenerationsToChatMessages({
            messages: responseMessages as UIMessage[],
            supabase,
            threadId: row.thread_id,
            userId: row.user_id,
          })
        } catch (persistError) {
          console.error("[generation-follow-up-resume] Failed to persist thread:", persistError)
        }
      },
    })

    await consumeStream({ stream })

    await supabase
      .from("generation_follow_ups")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)

    return { skipped: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await failRow(message)
    console.error("[generation-follow-up-resume]", err)
    return { skipped: false, error: message }
  }
}
