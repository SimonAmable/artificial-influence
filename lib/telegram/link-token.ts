import { createHmac, timingSafeEqual } from "crypto"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getTelegramBotToken } from "@/lib/telegram/config"

const TOKEN_TTL_SEC = 15 * 60
const USER_ID_HEX_LENGTH = 32
const EXP_LENGTH = 8
const SIG_LENGTH = 16

function getLinkSecret(): string | null {
  return getTelegramBotToken()
}

function userIdToHex(userId: string): string | null {
  const hex = userId.replace(/-/g, "").toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(hex)) {
    return null
  }
  return hex
}

function hexToUserId(hex: string): string | null {
  if (!/^[0-9a-f]{32}$/i.test(hex)) {
    return null
  }
  const normalized = hex.toLowerCase()
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`
}

function signPayload(expPart: string, userHex: string, secret: string): string {
  return createHmac("sha256", secret).update(`${expPart}.${userHex}`).digest("hex").slice(0, SIG_LENGTH)
}

export function createTelegramLinkToken(userId: string): string | null {
  const secret = getLinkSecret()
  const userHex = userIdToHex(userId)
  if (!secret || !userHex) {
    return null
  }

  const expPart = (Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC).toString(36).padStart(EXP_LENGTH, "0")
  const signature = signPayload(expPart, userHex, secret)
  return `${expPart}${userHex}${signature}`
}

function verifyTelegramLinkToken(token: string): { userId: string } | null {
  const secret = getLinkSecret()
  if (!secret) {
    return null
  }

  const normalized = token.trim()
  if (normalized.length !== EXP_LENGTH + USER_ID_HEX_LENGTH + SIG_LENGTH) {
    return null
  }

  const expPart = normalized.slice(0, EXP_LENGTH)
  const userHex = normalized.slice(EXP_LENGTH, EXP_LENGTH + USER_ID_HEX_LENGTH)
  const signature = normalized.slice(EXP_LENGTH + USER_ID_HEX_LENGTH)
  const expected = signPayload(expPart, userHex, secret)

  try {
    const sigBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expected)
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null
    }
  } catch {
    return null
  }

  const exp = Number.parseInt(expPart, 36)
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return null
  }

  const userId = hexToUserId(userHex)
  if (!userId) {
    return null
  }

  return { userId }
}

export async function consumeTelegramLinkToken(
  token: string,
  chatId: number,
): Promise<{ ok: true; userId: string } | { ok: false; reason: string }> {
  const supabase = createServiceRoleClient()
  if (!supabase) {
    return { ok: false, reason: "Server configuration error." }
  }

  const verified = verifyTelegramLinkToken(token)
  if (!verified) {
    return { ok: false, reason: "Invalid or expired link. Generate a new one from UniCan settings." }
  }

  const { data: existingOwner } = await supabase
    .from("profiles")
    .select("id")
    .eq("telegram_chat_id", chatId)
    .neq("id", verified.userId)
    .maybeSingle()

  if (existingOwner) {
    return { ok: false, reason: "This Telegram account is already linked to another UniCan user." }
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ telegram_chat_id: chatId })
    .eq("id", verified.userId)

  if (profileError) {
    console.error("[telegram/link-token] profile update failed:", profileError)
    return { ok: false, reason: "Could not link your account. Please try again." }
  }

  return { ok: true, userId: verified.userId }
}

export async function unlinkTelegramChat(chatId: number): Promise<void> {
  const supabase = createServiceRoleClient()
  if (!supabase) return

  await supabase.from("profiles").update({ telegram_chat_id: null }).eq("telegram_chat_id", chatId)
}
