import type { UIMessage } from "ai"

import type { AvailableChatImageReference } from "@/lib/chat/tools/image-reference-types"
import type {
  AvailableChatAudioReference,
  AvailableChatVideoReference,
} from "@/lib/chat/tools/generate-video"

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

type GenerateAudioToolPart = {
  type: "tool-generateAudio"
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  output?: {
    audio?: {
      mimeType?: string
      url: string
    }
  }
}

export function getAvailableConversationImageReferences(
  messages: UIMessage[],
): AvailableChatImageReference[] {
  const references: AvailableChatImageReference[] = []
  let referenceCount = 0

  for (const [, message] of messages.entries()) {
    if (message.role === "user") {
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
      if (part.type !== "tool-generateImageWithNanoBanana" && part.type !== "tool-generateImage") {
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

export function getAvailableConversationVideoReferences(
  messages: UIMessage[],
): AvailableChatVideoReference[] {
  const references: AvailableChatVideoReference[] = []
  let referenceCount = 0

  for (const message of messages) {
    if (message.role !== "user") {
      continue
    }

    for (const part of message.parts) {
      if (part.type !== "file" || !part.mediaType?.startsWith("video/")) {
        continue
      }

      referenceCount += 1
      references.push({
        id: `refv_${referenceCount}`,
        filename: part.filename,
        label: `uploaded video${part.filename ? ` "${part.filename}"` : ""}`,
        mediaType: part.mediaType,
        url: part.url,
      })
    }
  }

  return references
}

export function getAvailableConversationAudioReferences(
  messages: UIMessage[],
): AvailableChatAudioReference[] {
  const references: AvailableChatAudioReference[] = []
  let referenceCount = 0

  for (const [, message] of messages.entries()) {
    if (message.role === "user") {
      for (const part of message.parts) {
        if (part.type !== "file" || !part.mediaType?.startsWith("audio/")) {
          continue
        }

        referenceCount += 1
        references.push({
          id: `refa_${referenceCount}`,
          filename: part.filename,
          label: `uploaded audio${part.filename ? ` "${part.filename}"` : ""}`,
          mediaType: part.mediaType,
          url: part.url,
        })
      }
    }

    for (const part of message.parts) {
      if (part.type !== "tool-generateAudio") {
        continue
      }

      const toolPart = part as unknown as GenerateAudioToolPart

      if (toolPart.state !== "output-available" || !toolPart.output?.audio?.url) {
        continue
      }

      referenceCount += 1
      references.push({
        id: `refa_${referenceCount}`,
        label: "generated audio",
        mediaType: toolPart.output.audio.mimeType,
        url: toolPart.output.audio.url,
      })
    }
  }

  return references
}
