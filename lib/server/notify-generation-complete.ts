import type { SupabaseClient } from "@supabase/supabase-js"

import { buildGenerationHistoryDeepLink } from "@/lib/library/generation-history-path"
import { getAppBaseUrl } from "@/lib/telegram/config"
import {
  sendTelegramDocument,
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramVideo,
} from "@/lib/telegram/bot-api"

type GenerationNotificationRow = {
  id: string
  type: "image" | "video" | "audio" | string
  supabase_storage_path: string | null
  prompt: string | null
}

type TelegramProfileRow = {
  telegram_chat_id: number | null
}

function mediaLabel(type: GenerationNotificationRow["type"]): string {
  switch (type) {
    case "image":
      return "image"
    case "video":
      return "video"
    case "audio":
      return "audio"
    default:
      return "generation"
  }
}

function buildOpenButton(url: string) {
  return {
    inline_keyboard: [[{ text: "Open in Library", url }]],
  }
}

function filenameFromStoragePath(storagePath: string): string {
  const filename = storagePath.split("/").pop()?.trim()
  return filename && filename.length > 0 ? filename : "generation"
}

async function downloadGenerationFile(
  supabaseAdmin: SupabaseClient,
  storagePath: string,
): Promise<{ buffer: Buffer; filename: string } | null> {
  const { data, error } = await supabaseAdmin.storage.from("public-bucket").download(storagePath)
  if (error || !data) {
    console.error("[notify-generation-complete] storage download failed:", error?.message ?? "missing file")
    return null
  }

  return {
    buffer: Buffer.from(await data.arrayBuffer()),
    filename: filenameFromStoragePath(storagePath),
  }
}

async function sendPreviewMessage(
  chatId: number,
  input: {
    type: GenerationNotificationRow["type"]
    publicUrl: string
    caption: string
    replyMarkup: ReturnType<typeof buildOpenButton>
  },
): Promise<number | null> {
  if (input.type === "image") {
    return sendTelegramPhoto(chatId, {
      photoUrl: input.publicUrl,
      caption: input.caption,
      replyMarkup: input.replyMarkup,
    })
  }

  if (input.type === "video") {
    return sendTelegramVideo(chatId, {
      videoUrl: input.publicUrl,
      caption: input.caption,
      replyMarkup: input.replyMarkup,
    })
  }

  return sendTelegramMessage(chatId, {
    text: input.caption,
    replyMarkup: input.replyMarkup,
  })
}

export async function notifyGenerationCompleteTelegram(
  supabaseAdmin: SupabaseClient,
  input: {
    userId: string
    generationId: string
  },
): Promise<void> {
  try {
    const [{ data: profile }, { data: generation }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("telegram_chat_id")
        .eq("id", input.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("generations")
        .select("id, type, supabase_storage_path, prompt")
        .eq("id", input.generationId)
        .eq("user_id", input.userId)
        .maybeSingle(),
    ])

    const telegramProfile = profile as TelegramProfileRow | null
    const generationRow = generation as GenerationNotificationRow | null

    if (typeof telegramProfile?.telegram_chat_id !== "number") {
      return
    }

    if (!generationRow?.supabase_storage_path) {
      return
    }

    if (generationRow.type === "audio") {
      return
    }

    const chatId = telegramProfile.telegram_chat_id
    const label = mediaLabel(generationRow.type)
    const deepLink = buildGenerationHistoryDeepLink(generationRow.id, getAppBaseUrl())
    const caption = `Your ${label} is ready! Tap the file below for full resolution.`
    const replyMarkup = buildOpenButton(deepLink)

    const { data: urlData } = supabaseAdmin.storage
      .from("public-bucket")
      .getPublicUrl(generationRow.supabase_storage_path)

    const previewMessageId = await sendPreviewMessage(chatId, {
      type: generationRow.type,
      publicUrl: urlData.publicUrl,
      caption,
      replyMarkup,
    })

    const file = await downloadGenerationFile(supabaseAdmin, generationRow.supabase_storage_path)
    if (!file) {
      if (previewMessageId === null) {
        await sendTelegramMessage(chatId, {
          text: `${caption}\n\n${deepLink}`,
          replyMarkup,
        })
      }
      return
    }

    const documentMessageId = await sendTelegramDocument(chatId, {
      buffer: file.buffer,
      filename: file.filename,
      caption: "Full resolution",
      replyToMessageId: previewMessageId ?? undefined,
    })

    if (previewMessageId === null && documentMessageId === null) {
      await sendTelegramMessage(chatId, {
        text: `${caption}\n\n${deepLink}`,
        replyMarkup,
      })
    }
  } catch (error) {
    console.error("[notify-generation-complete] telegram failed:", error)
  }
}
