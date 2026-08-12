import { getCurrentProductSiteUrl } from "@/lib/product/current"

export function getTelegramBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null
}

export function getTelegramBotUsername(): string | null {
  return process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim() || null
}

export function getTelegramWebhookSecret(): string | null {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null
}

export function isTelegramConfigured(): boolean {
  return Boolean(getTelegramBotToken() && getTelegramBotUsername())
}

export function getAppBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? getCurrentProductSiteUrl()).replace(/\/$/, "")
}
