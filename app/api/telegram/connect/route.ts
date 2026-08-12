import { NextResponse } from "next/server"

import { createTelegramLinkToken } from "@/lib/telegram/link-token"
import { getTelegramBotUsername, isTelegramConfigured } from "@/lib/telegram/config"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    if (!isTelegramConfigured()) {
      return NextResponse.json(
        { error: "Telegram alerts are not configured on this server." },
        { status: 503 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 })
    }

    const token = createTelegramLinkToken(user.id)
    if (!token) {
      return NextResponse.json({ error: "Could not create Telegram link." }, { status: 500 })
    }

    const botUsername = getTelegramBotUsername()
    if (!botUsername) {
      return NextResponse.json({ error: "Telegram bot username is not configured." }, { status: 503 })
    }

    const deepLink = `https://t.me/${botUsername}?start=${token}`

    return NextResponse.json({ deepLink })
  } catch (error) {
    console.error("[telegram/connect] GET exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
