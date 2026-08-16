import { getTelegramBotToken } from "@/lib/telegram/config"

const TELEGRAM_MAX_FILE_BYTES = 50 * 1024 * 1024

type TelegramInlineKeyboardButton = {
  text: string
  url: string
}

type TelegramReplyMarkup = {
  inline_keyboard: TelegramInlineKeyboardButton[][]
}

type TelegramMessageResult = {
  message_id: number
}

type TelegramApiPayload = {
  ok?: boolean
  description?: string
  result?: TelegramMessageResult
}

type SendMessageOptions = {
  text: string
  replyMarkup?: TelegramReplyMarkup
  replyToMessageId?: number
}

type SendPhotoOptions = {
  photoUrl: string
  caption: string
  replyMarkup?: TelegramReplyMarkup
  replyToMessageId?: number
}

type SendVideoOptions = {
  videoUrl: string
  caption: string
  replyMarkup?: TelegramReplyMarkup
  replyToMessageId?: number
}

type SendDocumentOptions = {
  buffer: Buffer
  filename: string
  mimeType?: string
  caption?: string
  replyMarkup?: TelegramReplyMarkup
  replyToMessageId?: number
}

async function callTelegramApi(method: string, body: Record<string, unknown>): Promise<TelegramMessageResult | null> {
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

    const payload = (await response.json()) as TelegramApiPayload
    if (!response.ok || payload.ok === false) {
      console.error("[telegram/bot-api]", method, payload.description ?? response.status)
      return null
    }

    return payload.result ?? null
  } catch (error) {
    console.error("[telegram/bot-api]", method, error)
    return null
  }
}

async function callTelegramMultipart(method: string, formData: FormData): Promise<TelegramMessageResult | null> {
  const token = getTelegramBotToken()
  if (!token) {
    console.warn("[telegram/bot-api] TELEGRAM_BOT_TOKEN is not configured")
    return null
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      body: formData,
    })

    const payload = (await response.json()) as TelegramApiPayload
    if (!response.ok || payload.ok === false) {
      console.error("[telegram/bot-api]", method, payload.description ?? response.status)
      return null
    }

    return payload.result ?? null
  } catch (error) {
    console.error("[telegram/bot-api]", method, error)
    return null
  }
}

export async function sendTelegramMessage(chatId: number, options: SendMessageOptions): Promise<number | null> {
  const result = await callTelegramApi("sendMessage", {
    chat_id: chatId,
    text: options.text,
    disable_web_page_preview: false,
    reply_markup: options.replyMarkup,
    reply_to_message_id: options.replyToMessageId,
  })

  return result?.message_id ?? null
}

export async function sendTelegramPhoto(chatId: number, options: SendPhotoOptions): Promise<number | null> {
  const result = await callTelegramApi("sendPhoto", {
    chat_id: chatId,
    photo: options.photoUrl,
    caption: options.caption,
    reply_markup: options.replyMarkup,
    reply_to_message_id: options.replyToMessageId,
  })

  if (result !== null) {
    return result.message_id
  }

  return sendTelegramMessage(chatId, {
    text: options.caption,
    replyMarkup: options.replyMarkup,
    replyToMessageId: options.replyToMessageId,
  })
}

export async function sendTelegramVideo(chatId: number, options: SendVideoOptions): Promise<number | null> {
  const result = await callTelegramApi("sendVideo", {
    chat_id: chatId,
    video: options.videoUrl,
    caption: options.caption,
    reply_markup: options.replyMarkup,
    reply_to_message_id: options.replyToMessageId,
  })

  if (result !== null) {
    return result.message_id
  }

  return sendTelegramMessage(chatId, {
    text: options.caption,
    replyMarkup: options.replyMarkup,
    replyToMessageId: options.replyToMessageId,
  })
}

export async function sendTelegramDocument(chatId: number, options: SendDocumentOptions): Promise<number | null> {
  if (options.buffer.byteLength > TELEGRAM_MAX_FILE_BYTES) {
    console.warn("[telegram/bot-api] document exceeds Telegram 50MB limit:", options.filename)
    return null
  }

  const formData = new FormData()
  formData.append("chat_id", String(chatId))
  formData.append(
    "document",
    new Blob([options.buffer], { type: options.mimeType ?? "application/octet-stream" }),
    options.filename,
  )

  if (options.caption) {
    formData.append("caption", options.caption)
  }

  if (options.replyMarkup) {
    formData.append("reply_markup", JSON.stringify(options.replyMarkup))
  }

  if (typeof options.replyToMessageId === "number") {
    formData.append("reply_to_message_id", String(options.replyToMessageId))
  }

  const result = await callTelegramMultipart("sendDocument", formData)
  return result?.message_id ?? null
}
