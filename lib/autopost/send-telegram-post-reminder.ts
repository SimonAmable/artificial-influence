import type { AutopostCarouselItem, AutopostJobMetadata } from "@/lib/autopost/types"
import {
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramVideo,
} from "@/lib/telegram/bot-api"

export const TELEGRAM_POST_CONNECTION_ID = "telegram"

type SendTelegramPostReminderInput = {
  chatId: number
  caption: string | null
  mediaUrl: string
  metadata: AutopostJobMetadata
  scheduledAt?: string | null
}

function inferMediaKindFromUrl(url: string): "image" | "video" {
  try {
    const pathname = new URL(url).pathname
    if (/\.(mp4|mov|webm|m4v)$/i.test(pathname)) {
      return "video"
    }
  } catch {
    // fall through
  }
  return "image"
}

function resolveMediaItems(
  mediaUrl: string,
  metadata: AutopostJobMetadata,
): AutopostCarouselItem[] {
  const carouselItems = metadata.carouselItems?.filter((item) => item.url?.trim()) ?? []
  if (carouselItems.length > 0) {
    return carouselItems
  }

  const assetKind = metadata.assetKind === "video" ? "video" : inferMediaKindFromUrl(mediaUrl)
  return [{ url: mediaUrl, kind: assetKind }]
}

function buildReminderHeader(scheduledAt?: string | null, targetPlatform?: string | null): string {
  const lines = ["Post reminder"]

  if (scheduledAt) {
    const date = new Date(scheduledAt)
    if (Number.isFinite(date.getTime())) {
      lines.push(`Scheduled for ${date.toLocaleString()}`)
    }
  }

  if (targetPlatform?.trim()) {
    lines.push(`Target platform: ${targetPlatform.trim()}`)
  }

  lines.push("")
  lines.push("Copy the caption and media below when you are ready to publish.")
  return lines.join("\n")
}

function buildMediaCaption(caption: string | null, itemIndex: number, totalItems: number): string {
  const trimmed = caption?.trim() ?? ""
  if (itemIndex === 0) {
    if (trimmed) {
      return totalItems > 1 ? `${trimmed}\n\n(${itemIndex + 1}/${totalItems})` : trimmed
    }
    return totalItems > 1 ? `Post media (${itemIndex + 1}/${totalItems})` : "Post media"
  }

  return totalItems > 1 ? `Post media (${itemIndex + 1}/${totalItems})` : "Post media"
}

export async function sendTelegramPostReminder(
  input: SendTelegramPostReminderInput,
): Promise<{ messageId: number | null }> {
  const targetPlatform = input.metadata.telegram?.targetPlatform ?? null
  const header = buildReminderHeader(input.scheduledAt, targetPlatform)

  const headerMessageId = await sendTelegramMessage(input.chatId, { text: header })
  const mediaItems = resolveMediaItems(input.mediaUrl, input.metadata)

  let firstMessageId: number | null = headerMessageId

  for (let index = 0; index < mediaItems.length; index += 1) {
    const item = mediaItems[index]
    const mediaCaption = buildMediaCaption(input.caption, index, mediaItems.length)
    const replyToMessageId = index === 0 ? (headerMessageId ?? undefined) : undefined

    const messageId =
      item.kind === "video"
        ? await sendTelegramVideo(input.chatId, {
            videoUrl: item.url,
            caption: mediaCaption,
            replyToMessageId,
          })
        : await sendTelegramPhoto(input.chatId, {
            photoUrl: item.url,
            caption: mediaCaption,
            replyToMessageId,
          })

    if (index === 0 && messageId !== null) {
      firstMessageId = messageId
    }
  }

  return { messageId: firstMessageId }
}
