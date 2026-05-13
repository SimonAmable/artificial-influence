import {
  consumeStream,
  createAgentUIStreamResponse,
  createIdGenerator,
  convertToModelMessages,
  type InferAgentUIMessage,
  streamText,
  TypeValidationError,
  validateUIMessages,
  type UIMessage,
} from "ai"
import {
  type ChatThread,
  getChatThreadById,
  updateChatThreadMessages,
} from "@/lib/chat/database-server"
import { createClient } from "@/lib/supabase/server"
import { PROMPT_RECREATE_SYSTEM_PROMPT } from "@/lib/constants/system-prompts"
import { createCreativeAgent } from "@/lib/chat/creative-agent"
import { loadActiveModels } from "@/lib/chat/tools/search-models"
import { loadSkillsCatalog } from "@/lib/chat/skills/catalog"
import { loadPinnedSkillInstructionsForUser } from "@/lib/chat/skills/pins"
import { bindPendingGenerationsToChatMessages } from "@/lib/chat/media-persistence"
import { sanitizeToolErrorPartsInMessages } from "@/lib/chat/sanitize-ui-messages"
import { createCreativeChatTools } from "@/lib/chat/tools"
import { getAutomationDefaultsFromMessages } from "@/lib/chat/automation-defaults"
import {
  getAvailableConversationAudioReferences,
  getAvailableConversationImageReferences,
  getAvailableConversationVideoReferences,
} from "@/lib/chat/conversation-references"
import { resolveChatGatewayModel } from "@/lib/constants/chat-llm-models"
import { buildSelectedReferenceContext } from "@/lib/chat/selected-reference-context"
import { registerThreadMediaFromUserMessage } from "@/lib/chat/thread-media/server"
import { buildOnboardingHiddenContext } from "@/lib/onboarding/hidden-context"
import {
  AI_GATEWAY_CONFIG_ERROR,
  createAIGatewayProvider,
  hasAIGatewayCredentials,
} from "@/lib/ai/gateway"
import { scheduleThreadIntentTitleJob } from "@/lib/chat/thread-intent-title-scheduler"

/** Allows long chained tool turns (e.g. awaitGeneration + follow-up tools) on Vercel Pro (max 300s). */
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    if (!hasAIGatewayCredentials()) {
      console.error("[chat] AI Gateway credentials not configured")
      return new Response(
        JSON.stringify({ error: AI_GATEWAY_CONFIG_ERROR }),
        { status: 500 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[chat] Authentication failed:", authError?.message || "No user")
      return new Response(
        JSON.stringify({ error: "Unauthorized. Please log in to use chat." }),
        { status: 401 },
      )
    }

    const body = await req.json()
    const {
      message,
      messages,
      mode = "chat",
      model: modelFromBody,
      threadId,
      onboardingHandoff,
    }: {
      message?: UIMessage
      messages?: UIMessage[]
      mode?: "chat" | "prompt-recreate"
      model?: string
      threadId?: string
      onboardingHandoff?: boolean
    } = body

    const model = resolveChatGatewayModel(
      typeof modelFromBody === "string" ? modelFromBody : undefined,
    )

    let persistedChatThread: ChatThread | null = null

    if (threadId) {
      const existingThread = await getChatThreadById(threadId, user.id)

      if (!existingThread) {
        return new Response(JSON.stringify({ error: "Chat thread not found" }), { status: 404 })
      }

      persistedChatThread = existingThread
    }

    let requestMessages: UIMessage[]
    /** True when this POST is the opening turn for persisted thread rows (frozen for onFinish callbacks). */
    const isOpeningThreadTurn = Boolean(
      threadId && persistedChatThread && persistedChatThread.messages.length === 0,
    )

    if (threadId && message && persistedChatThread) {
      requestMessages = [...persistedChatThread.messages, message]
    } else if (Array.isArray(messages)) {
      requestMessages = messages
    } else {
      return new Response(JSON.stringify({ error: "No chat messages were provided" }), { status: 400 })
    }

    const sanitizedRequest = sanitizeToolErrorPartsInMessages(requestMessages)
    requestMessages = sanitizedRequest.messages

    if (threadId && sanitizedRequest.changed) {
      try {
        await updateChatThreadMessages(threadId, user.id, requestMessages)
      } catch (sanitizePersistError) {
        console.error("[chat] Failed to persist sanitized thread:", sanitizePersistError)
      }
    }

    const [skillsCatalog, pinnedSkillInstructions] = await Promise.all([
      loadSkillsCatalog(supabase, user.id),
      loadPinnedSkillInstructionsForUser(supabase, user.id),
    ])
    const automationDefaults = getAutomationDefaultsFromMessages(requestMessages)

    const validationTools = createCreativeChatTools({
      availableReferences: [],
      availableVideoReferences: [],
      availableAudioReferences: [],
      defaultAutomationRefs: automationDefaults.refs,
      defaultAutomationAttachments: automationDefaults.attachments,
      supabase,
      threadId,
      userId: user.id,
      skillsCatalog,
    }) as NonNullable<Parameters<typeof validateUIMessages>[0]["tools"]>

    let validatedMessages: UIMessage[]

    try {
      validatedMessages = await validateUIMessages({
        messages: requestMessages,
        tools: validationTools,
      })
    } catch (validationError) {
      if (validationError instanceof TypeValidationError) {
        console.error("[chat] Message validation failed:", validationError)
        if ("cause" in validationError) {
          console.error("[chat] Message validation cause:", validationError.cause)
        }
        return new Response(
          JSON.stringify({ error: "Stored chat messages no longer match the current tool schema." }),
          { status: 400 },
        )
      }

      throw validationError
    }

    const openingUserUiMessageForIntentTitle = validatedMessages.find((entry) => entry.role === "user")

    const lastUserMessageForMedia = [...validatedMessages].reverse().find((m) => m.role === "user")
    if (threadId && lastUserMessageForMedia) {
      try {
        await registerThreadMediaFromUserMessage(supabase, user.id, threadId, lastUserMessageForMedia)
      } catch (registerError) {
        console.error("[chat] Thread media registration failed:", registerError)
      }
    }

    if (mode === "prompt-recreate") {
      const gateway = createAIGatewayProvider()

      const convertedMessages = await convertToModelMessages(validatedMessages)
      const streamResult = streamText({
        model: gateway(model),
        system: PROMPT_RECREATE_SYSTEM_PROMPT,
        messages: convertedMessages,
        temperature: 0.7,
      })

      if (threadId) {
        void streamResult.consumeStream()
      }

      return streamResult.toUIMessageStreamResponse({
        generateMessageId: createIdGenerator({
          prefix: "msg",
          size: 16,
        }),
        originalMessages: validatedMessages,
        onFinish: async ({ messages: responseMessages, isAborted }) => {
          if (!threadId || isAborted) {
            return
          }

          try {
            await updateChatThreadMessages(threadId, user.id, responseMessages)
            scheduleThreadIntentTitleJob({
              threadId,
              userId: user.id,
              threadSource: persistedChatThread?.source,
              isOpeningTurn: isOpeningThreadTurn,
              onboardingHandoff: onboardingHandoff === true,
              openingUserMessage: openingUserUiMessageForIntentTitle,
            })
          } catch (persistError) {
            console.error("[chat] Failed to persist thread:", persistError)
          }
        },
      })
    }

    const selectedReferenceContext = await buildSelectedReferenceContext(
      supabase,
      user.id,
      validatedMessages,
    )

    const preloadedModels = await loadActiveModels(supabase).catch((preloadError) => {
      console.error("[chat] Failed to pre-load active models for system prompt:", preloadError)
      return undefined
    })

    let onboardingContext = ""

    if (onboardingHandoff === true && isOpeningThreadTurn) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("onboarding_json_data")
        .eq("id", user.id)
        .maybeSingle()

      if (profileError) {
        console.error("[chat] Failed to load onboarding context:", profileError)
      } else {
        onboardingContext = buildOnboardingHiddenContext(
          (profile as { onboarding_json_data?: unknown } | null)?.onboarding_json_data,
        )
      }
      }

    const creativeAgent = createCreativeAgent({
      availableReferences: getAvailableConversationImageReferences(validatedMessages),
      availableVideoReferences: getAvailableConversationVideoReferences(validatedMessages),
      availableAudioReferences: getAvailableConversationAudioReferences(validatedMessages),
      defaultAutomationRefs: automationDefaults.refs,
      defaultAutomationAttachments: automationDefaults.attachments,
      model,
      selectedReferenceContext,
      onboardingContext,
      pinnedSkillInstructions,
      skillsCatalog,
      supabase,
      threadId,
      userId: user.id,
      preloadedModels,
    })
    type CreativeAgentUIMessage = InferAgentUIMessage<typeof creativeAgent>
    const creativeAgentMessages = validatedMessages as CreativeAgentUIMessage[]

    return createAgentUIStreamResponse({
      agent: creativeAgent,
      uiMessages: creativeAgentMessages,
      consumeSseStream: threadId
        ? ({ stream }) =>
            consumeStream({
              stream,
              onError: (persistError) => {
                console.error("[chat] Failed to consume agent SSE stream:", persistError)
              },
            })
        : undefined,
      generateMessageId: createIdGenerator({
        prefix: "msg",
        size: 16,
      }),
      originalMessages: creativeAgentMessages,
      sendReasoning: false,
      onFinish: async ({ messages: responseMessages, isAborted }) => {
        if (!threadId || isAborted) {
          return
        }

        try {
          await updateChatThreadMessages(threadId, user.id, responseMessages as UIMessage[])
          await bindPendingGenerationsToChatMessages({
            messages: responseMessages as UIMessage[],
            supabase,
            threadId,
            userId: user.id,
          })
          scheduleThreadIntentTitleJob({
            threadId,
            userId: user.id,
            threadSource: persistedChatThread?.source,
            isOpeningTurn: isOpeningThreadTurn,
            onboardingHandoff: onboardingHandoff === true,
            openingUserMessage: openingUserUiMessageForIntentTitle,
          })
        } catch (persistError) {
          console.error("[chat] Failed to persist thread:", persistError)
        }
      },
    })
  } catch (error) {
    console.error("[chat] Error:", error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "An error occurred during chat processing",
      }),
      { status: 500 },
    )
  }
}
