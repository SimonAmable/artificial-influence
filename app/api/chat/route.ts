import {
  consumeStream,
  createAgentUIStreamResponse,
  createGateway,
  createIdGenerator,
  convertToModelMessages,
  type InferAgentUIMessage,
  streamText,
  TypeValidationError,
  validateUIMessages,
  type UIMessage,
} from "ai"
import { getChatThreadById, updateChatThreadMessages } from "@/lib/chat/database-server"
import { createClient } from "@/lib/supabase/server"
import { PROMPT_RECREATE_SYSTEM_PROMPT } from "@/lib/constants/system-prompts"
import { createCreativeAgent } from "@/lib/chat/creative-agent"
import { bindPendingGenerationsToChatMessages } from "@/lib/chat/media-persistence"
import { createCreativeChatTools } from "@/lib/chat/tools"
import { getSelectedReferencesFromMessage } from "@/lib/chat/reference-metadata"
import { brandKitFromRow } from "@/lib/brand-kit/database-server"
import { resolveChatGatewayModel } from "@/lib/constants/chat-llm-models"
import { formatBrandKitForPrompt } from "@/lib/brand-kit/format-for-prompt"
import type {
  AvailableChatImageReference,
  ChatImageReference,
} from "@/lib/chat/tools/generate-image-with-nano-banana"
import type { ChatAudioReference, ChatVideoReference } from "@/lib/chat/tools/generate-video"

type GenerateImageToolPart = {
  type: "tool-generateImageWithNanoBanana"
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  output?: {
    images?: Array<{
      mimeType?: string
      url: string
    }>
  }
}

type UniversalGenerateImageToolPart = {
  type: "tool-generateImage"
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  output?: {
    images?: Array<{
      mimeType?: string
      url: string
    }>
  }
}

function getLatestUserImageAttachments(messages: UIMessage[]): ChatImageReference[] {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")

  if (!latestUserMessage) {
    return []
  }

  return latestUserMessage.parts.flatMap((part) => {
    if (part.type !== "file") {
      return []
    }

    if (!part.mediaType?.startsWith("image/")) {
      return []
    }

    return [
      {
        filename: part.filename,
        mediaType: part.mediaType,
        url: part.url,
      },
    ]
  })
}

function getLatestUserVideoAttachments(messages: UIMessage[]): ChatVideoReference[] {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")

  if (!latestUserMessage) {
    return []
  }

  return latestUserMessage.parts.flatMap((part) => {
    if (part.type !== "file") {
      return []
    }

    if (!part.mediaType?.startsWith("video/")) {
      return []
    }

    return [
      {
        filename: part.filename,
        mediaType: part.mediaType,
        url: part.url,
      },
    ]
  })
}

function getLatestUserAudioAttachments(messages: UIMessage[]): ChatAudioReference[] {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")

  if (!latestUserMessage) {
    return []
  }

  return latestUserMessage.parts.flatMap((part) => {
    if (part.type !== "file") {
      return []
    }

    if (!part.mediaType?.startsWith("audio/")) {
      return []
    }

    return [
      {
        filename: part.filename,
        mediaType: part.mediaType,
        url: part.url,
      },
    ]
  })
}

function getAvailableConversationImageReferences(messages: UIMessage[]): AvailableChatImageReference[] {
  const latestUserMessageIndex = (() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === "user") {
        return index
      }
    }

    return -1
  })()

  const references: AvailableChatImageReference[] = []
  let referenceCount = 0

  for (const [messageIndex, message] of messages.entries()) {
    if (message.role === "user") {
      if (messageIndex === latestUserMessageIndex) {
        continue
      }

      for (const part of message.parts) {
        if (part.type !== "file" || !part.mediaType?.startsWith("image/")) {
          continue
        }

        referenceCount += 1
        references.push({
          id: `ref_${referenceCount}`,
          filename: part.filename,
          label: `uploaded image${part.filename ? ` "${part.filename}"` : ""}`,
          mediaType: part.mediaType,
          source: "user-upload",
          url: part.url,
        })
      }
    }

    for (const part of message.parts) {
      if (
        part.type !== "tool-generateImageWithNanoBanana" &&
        part.type !== "tool-generateImage"
      ) {
        continue
      }

      const toolPart = part as unknown as GenerateImageToolPart | UniversalGenerateImageToolPart

      if (toolPart.state !== "output-available") {
        continue
      }

      for (const image of toolPart.output?.images ?? []) {
        referenceCount += 1
        references.push({
          id: `ref_${referenceCount}`,
          label:
            part.type === "tool-generateImageWithNanoBanana"
              ? "generated Nano Banana image"
              : "generated image",
          mediaType: image.mimeType,
          source: "generated",
          url: image.url,
        })
      }
    }
  }

  return references
}

function extractDatabaseId(prefixedId: string, prefix: "brand:" | "asset:") {
  if (!prefixedId.startsWith(prefix)) return null
  const value = prefixedId.slice(prefix.length).trim()
  return value || null
}

async function buildSelectedReferenceContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  messages: UIMessage[],
) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")
  const selectedRefs = latestUserMessage ? getSelectedReferencesFromMessage(latestUserMessage) : []

  if (selectedRefs.length === 0) {
    return ""
  }

  const brandIds = selectedRefs
    .filter((ref) => ref.category === "brand")
    .map((ref) => extractDatabaseId(ref.id, "brand:"))
    .filter((value): value is string => Boolean(value))

  const assetIds = selectedRefs
    .filter((ref) => ref.category === "asset")
    .map((ref) => extractDatabaseId(ref.id, "asset:"))
    .filter((value): value is string => Boolean(value))

  const sections: string[] = []

  if (brandIds.length > 0) {
    const { data: brandRows, error: brandError } = await supabase
      .from("brand_kits")
      .select("*")
      .eq("user_id", userId)
      .in("id", brandIds)

    if (brandError) {
      throw new Error(`Failed to load selected brand kits: ${brandError.message}`)
    }

    const brands = (brandRows ?? []).map((row) => brandKitFromRow(row as Record<string, unknown>))
    if (brands.length > 0) {
      sections.push(
        `User-selected brand context for this turn:\n${brands
          .map((brand) => `---\n${formatBrandKitForPrompt(brand)}`)
          .join("\n")}`,
      )
    }
  }

  if (assetIds.length > 0) {
    const { data: assetRows, error: assetError } = await supabase
      .from("assets")
      .select("id, title, asset_type, category, asset_url")
      .eq("user_id", userId)
      .in("id", assetIds)

    if (assetError) {
      throw new Error(`Failed to load selected assets: ${assetError.message}`)
    }

    if ((assetRows ?? []).length > 0) {
      sections.push(
        `User-selected asset references for this turn:\n${(assetRows ?? [])
          .map((row) => {
            const asset = row as {
              asset_type: string
              asset_url: string
              category: string
              title: string
            }
            return `- ${asset.title} (${asset.asset_type}, ${asset.category}): ${asset.asset_url}`
          })
          .join("\n")}`,
      )
    }
  }

  return sections.join("\n\n").trim()
}

export async function POST(req: Request) {
  try {
    if (!process.env.AI_GATEWAY_API_KEY) {
      console.error("[chat] AI_GATEWAY_API_KEY not set")
      return new Response(
        JSON.stringify({ error: "AI_GATEWAY_API_KEY environment variable is not set" }),
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
    }: {
      message?: UIMessage
      messages?: UIMessage[]
      mode?: "chat" | "prompt-recreate"
      model?: string
      threadId?: string
    } = body

    const model = resolveChatGatewayModel(
      typeof modelFromBody === "string" ? modelFromBody : undefined,
    )

    let requestMessages: UIMessage[]

    if (threadId && message) {
      const existingThread = await getChatThreadById(threadId, user.id)

      if (!existingThread) {
        return new Response(JSON.stringify({ error: "Chat thread not found" }), { status: 404 })
      }

      requestMessages = [...existingThread.messages, message]
    } else if (Array.isArray(messages)) {
      requestMessages = messages
    } else {
      return new Response(JSON.stringify({ error: "No chat messages were provided" }), { status: 400 })
    }

    const validationTools = createCreativeChatTools({
      availableReferences: [],
      latestUserImages: [],
      latestUserVideos: [],
      latestUserAudios: [],
      supabase,
      userId: user.id,
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
        return new Response(
          JSON.stringify({ error: "Stored chat messages no longer match the current tool schema." }),
          { status: 400 },
        )
      }

      throw validationError
    }

    if (mode === "prompt-recreate") {
      const gateway = createGateway({
        apiKey: process.env.AI_GATEWAY_API_KEY,
      })

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

    const creativeAgent = createCreativeAgent({
      availableReferences: getAvailableConversationImageReferences(validatedMessages),
      latestUserImages: getLatestUserImageAttachments(validatedMessages),
      latestUserVideos: getLatestUserVideoAttachments(validatedMessages),
      latestUserAudios: getLatestUserAudioAttachments(validatedMessages),
      model,
      selectedReferenceContext,
      supabase,
      userId: user.id,
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
