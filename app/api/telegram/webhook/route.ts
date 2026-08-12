import { NextRequest, NextResponse } from "next/server"

import { consumeTelegramLinkToken, unlinkTelegramChat } from "@/lib/telegram/link-token"
import { getTelegramWebhookSecret } from "@/lib/telegram/config"
import { sendTelegramMessage } from "@/lib/telegram/bot-api"

type TelegramUser = {
  id: number
}

type TelegramChat = {
  id: number
  type: string
}

type TelegramMessage = {
  message_id: number
  text?: string
  chat: TelegramChat
  from?: TelegramUser
}

type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
}

function verifyWebhookSecret(request: NextRequest): boolean {
  const expected = getTelegramWebhookSecret()
  if (!expected) {
    return false
  }

  const received = request.headers.get("x-telegram-bot-api-secret-token")
  return received === expected
}

function parseStartPayload(text: string): string | null {
  const match = text.trim().match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i)
  return match?.[1]?.trim() ?? null
}

export async function POST(request: NextRequest) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    const update = (await request.json()) as TelegramUpdate
    const message = update.message

    if (!message?.text || !message.chat || message.chat.type !== "private") {
      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat.id
    const text = message.text.trim()

    if (text.toLowerCase().startsWith("/disconnect")) {
      await unlinkTelegramChat(chatId)
      await sendTelegramMessage(chatId, {
        text: "Telegram alerts disconnected. You can link again anytime from UniCan settings.",
      })
      return NextResponse.json({ ok: true })
    }

    const startPayload = parseStartPayload(text)
    if (startPayload) {
      const result = await consumeTelegramLinkToken(startPayload, chatId)
      if (result.ok) {
        await sendTelegramMessage(chatId, {
          text: "Telegram alerts connected. You will get a message when your generations finish.",
        })
      } else {
        await sendTelegramMessage(chatId, { text: result.reason })
      }
      return NextResponse.json({ ok: true })
    }

    if (text.toLowerCase().startsWith("/start")) {
      await sendTelegramMessage(chatId, {
        text: "Open UniCan settings → Notifications → Connect Telegram to link your account.",
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[telegram/webhook] POST exception:", error)
    return NextResponse.json({ ok: true })
  }
}
