import type { SupabaseClient } from "@supabase/supabase-js"

import { buildGenerationHistoryDeepLink } from "@/lib/library/generation-history-path"
import { getAppBaseUrl } from "@/lib/telegram/config"
import {
  sendTelegramDocument,
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramVideo,
} from "@/lib/telegram/bot-api"

type ClaimedGenerationRow = {
  id: string
  type: "image" | "video" | "audio" | string
  supabase_storage_path: string | null
  prompt: string | null
}

type TelegramProfileRow = {
  telegram_chat_id: number | null
}

function mediaLabel(type: ClaimedGenerationRow["type"]): string {
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

async function sendSingleGenerationAlert(
  chatId: number,
  input: {
    type: ClaimedGenerationRow["type"]
    publicUrl: string
    caption: string
    replyMarkup: ReturnType<typeof buildOpenButton>
    file: { buffer: Buffer; filename: string } | null
  },
): Promise<boolean> {
  if (input.type === "image") {
    const photoMessageId = await sendTelegramPhoto(chatId, {
      photoUrl: input.publicUrl,
      caption: input.caption,
      replyMarkup: input.replyMarkup,
    })
    if (photoMessageId !== null) {
      return true
    }
  } else if (input.type === "video") {
    const videoMessageId = await sendTelegramVideo(chatId, {
      videoUrl: input.publicUrl,
      caption: input.caption,
      replyMarkup: input.replyMarkup,
    })
    if (videoMessageId !== null) {
      return true
    }
  }

  if (input.file) {
    const documentMessageId = await sendTelegramDocument(chatId, {
      buffer: input.file.buffer,
      filename: input.file.filename,
      caption: input.caption,
      replyMarkup: input.replyMarkup,
    })
    if (documentMessageId !== null) {
      return true
    }
  }

  const textMessageId = await sendTelegramMessage(chatId, {
    text: input.caption,
    replyMarkup: input.replyMarkup,
  })

  return textMessageId !== null
}

async function claimGenerationTelegramNotification(
  supabaseAdmin: SupabaseClient,
  input: {
    userId: string
    generationId: string
  },
): Promise<ClaimedGenerationRow | null> {
  const notifiedAt = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from("generations")
    .update({ telegram_notified_at: notifiedAt })
    .eq("id", input.generationId)
    .eq("user_id", input.userId)
    .eq("status", "completed")
    .is("telegram_notified_at", null)
    .select("id, type, supabase_storage_path, prompt")
    .maybeSingle()

  if (error) {
    console.error("[notify-generation-complete] claim failed:", error)
    return null
  }

  return (data as ClaimedGenerationRow | null) ?? null
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
        .select("id, type, supabase_storage_path, prompt, status, telegram_notified_at")
        .eq("id", input.generationId)
        .eq("user_id", input.userId)
        .maybeSingle(),
    ])

    const telegramProfile = profile as TelegramProfileRow | null
    const generationRow = generation as (ClaimedGenerationRow & {
      status?: string
      telegram_notified_at?: string | null
    }) | null

    if (typeof telegramProfile?.telegram_chat_id !== "number") {
      return
    }

    if (
      !generationRow?.supabase_storage_path ||
      generationRow.status !== "completed" ||
      generationRow.telegram_notified_at
    ) {
      return
    }

    if (generationRow.type === "audio") {
      return
    }

    const claimedRow = await claimGenerationTelegramNotification(supabaseAdmin, input)
    if (!claimedRow?.supabase_storage_path) {
      return
    }

    const chatId = telegramProfile.telegram_chat_id
    const label = mediaLabel(claimedRow.type)
    const deepLink = buildGenerationHistoryDeepLink(claimedRow.id, getAppBaseUrl())
    const caption = `Your ${label} is ready!`
    const replyMarkup = buildOpenButton(deepLink)

    const { data: urlData } = supabaseAdmin.storage
      .from("public-bucket")
      .getPublicUrl(claimedRow.supabase_storage_path)

    const file = await downloadGenerationFile(supabaseAdmin, claimedRow.supabase_storage_path)
    const sent = await sendSingleGenerationAlert(chatId, {
      type: claimedRow.type,
      publicUrl: urlData.publicUrl,
      caption,
      replyMarkup,
      file,
    })

    if (!sent) {
      console.error("[notify-generation-complete] all Telegram delivery attempts failed:", input.generationId)
    }
  } catch (error) {
    console.error("[notify-generation-complete] telegram failed:", error)
  }
}
