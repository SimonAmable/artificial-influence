import type { SupabaseClient } from "@supabase/supabase-js"

import { buildGenerationHistoryDeepLink } from "@/lib/library/generation-history-path"
import { getAppBaseUrl } from "@/lib/telegram/config"
import { sendTelegramMessage, sendTelegramPhoto } from "@/lib/telegram/bot-api"

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
    const caption = `Your ${label} is ready!`
    const replyMarkup = buildOpenButton(deepLink)

    if (generationRow.type === "image") {
      const { data: urlData } = supabaseAdmin.storage
        .from("public-bucket")
        .getPublicUrl(generationRow.supabase_storage_path)

      await sendTelegramPhoto(chatId, {
        photoUrl: urlData.publicUrl,
        caption,
        replyMarkup,
      })
      return
    }

    await sendTelegramMessage(chatId, {
      text: `${caption}\n\n${deepLink}`,
      replyMarkup,
    })
  } catch (error) {
    console.error("[notify-generation-complete] telegram failed:", error)
  }
}
