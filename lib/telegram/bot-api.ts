import { getTelegramBotToken } from "@/lib/telegram/config"

type TelegramInlineKeyboardButton = {
  text: string
  url: string
}

type TelegramReplyMarkup = {
  inline_keyboard: TelegramInlineKeyboardButton[][]
}

type SendMessageOptions = {
  text: string
  replyMarkup?: TelegramReplyMarkup
}

type SendPhotoOptions = {
  photoUrl: string
  caption: string
  replyMarkup?: TelegramReplyMarkup
}

async function callTelegramApi<T>(method: string, body: Record<string, unknown>): Promise<T | null> {
  const token = getTelegramBotToken()
  if (!token) {
    console.warn("[telegram/bot-api] TELEGRAM_BOT_TOKEN is not configured")
    return null
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const payload = (await response.json()) as { ok?: boolean; description?: string }
    if (!response.ok || payload.ok === false) {
      console.error("[telegram/bot-api]", method, payload.description ?? response.status)
      return null
    }

    return payload as T
  } catch (error) {
    console.error("[telegram/bot-api]", method, error)
    return null
  }
}

export async function sendTelegramMessage(chatId: number, options: SendMessageOptions): Promise<boolean> {
  const result = await callTelegramApi("sendMessage", {
    chat_id: chatId,
    text: options.text,
    disable_web_page_preview: false,
    reply_markup: options.replyMarkup,
  })

  return result !== null
}

export async function sendTelegramPhoto(chatId: number, options: SendPhotoOptions): Promise<boolean> {
  const result = await callTelegramApi("sendPhoto", {
    chat_id: chatId,
    photo: options.photoUrl,
    caption: options.caption,
    reply_markup: options.replyMarkup,
  })

  if (result !== null) {
    return true
  }

  return sendTelegramMessage(chatId, {
    text: options.caption,
    replyMarkup: options.replyMarkup,
  })
}
