import { NextResponse } from "next/server"

import { parseSavedProfileFromMetadata } from "@/lib/instagram/profile"
import { parseSocialMetadata, readStringMetadata, type SocialProvider } from "@/lib/social-connections"
import { parseTikTokSavedProfile } from "@/lib/tiktok/profile"
import { createClient } from "@/lib/supabase/server"

type SocialConnectionRow = {
  id: string
  provider: SocialProvider
  provider_account_id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  token_expires_at: string | null
  refresh_token_expires_at: string | null
  scopes: string[] | null
  status: string
  metadata: unknown
  updated_at: string
}

function toConnection(row: SocialConnectionRow) {
  const metadata = parseSocialMetadata(row.metadata)
  const instagramProfile = row.provider === "instagram" ? parseSavedProfileFromMetadata(row.metadata) : null
  const tiktokProfile = row.provider === "tiktok" ? parseTikTokSavedProfile(row.metadata) : null
  const instagramConnectionId = readStringMetadata(metadata, "instagram_connection_id")
  const accountType = readStringMetadata(metadata, "account_type")

  return {
    id: row.id,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    status: row.status,
    scopes: row.scopes ?? [],
    tokenExpiresAt: row.token_expires_at,
    refreshTokenExpiresAt: row.refresh_token_expires_at,
    updatedAt: row.updated_at,
    metadata,
    profile: row.provider === "instagram" ? instagramProfile : tiktokProfile,
    instagramConnectionId,
    instagramUserId: row.provider === "instagram" ? row.provider_account_id : null,
    instagramUsername: row.provider === "instagram" ? row.username : null,
    accountType,
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const { data: rows, error } = await supabase
      .from("social_connections")
      .select(
        "id, provider, provider_account_id, username, display_name, avatar_url, token_expires_at, refresh_token_expires_at, scopes, status, metadata, updated_at"
      )
      .eq("user_id", user.id)
      .in("status", ["connected", "error", "expired"])
      .order("updated_at", { ascending: false })

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("telegram_chat_id")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.error("[social-connections/status] telegram profile lookup failed:", profileError)
    }

    if (error) {
      console.error("[social-connections/status] query failed:", error)
      return NextResponse.json({ error: "Failed to fetch social connection status." }, { status: 500 })
    }

    const connections = ((rows ?? []) as SocialConnectionRow[]).map(toConnection)
    const instagram = connections.filter((connection) => connection.provider === "instagram")
    const tiktok = connections.filter((connection) => connection.provider === "tiktok")
    const fanvue = connections.filter((connection) => connection.provider === "fanvue")
    const telegramConnected = typeof profile?.telegram_chat_id === "number"

    return NextResponse.json({
      providers: {
        instagram: {
          connected: instagram.some((connection) => connection.status === "connected"),
          connections: instagram,
        },
        tiktok: {
          connected: tiktok.some((connection) => connection.status === "connected"),
          connections: tiktok,
        },
        fanvue: {
          connected: fanvue.some((connection) => connection.status === "connected"),
          connections: fanvue,
        },
        telegram: {
          connected: telegramConnected,
          connections: telegramConnected
            ? [
                {
                  id: "telegram",
                  provider: "telegram",
                  providerAccountId: String(profile.telegram_chat_id),
                  username: null,
                  displayName: "Telegram reminders",
                  avatarUrl: null,
                  status: "connected",
                  scopes: [],
                  tokenExpiresAt: null,
                  refreshTokenExpiresAt: null,
                  updatedAt: new Date().toISOString(),
                  metadata: {},
                  profile: null,
                  instagramConnectionId: null,
                  instagramUserId: null,
                  instagramUsername: null,
                  accountType: null,
                },
              ]
            : [],
        },
      },
      instagram: {
        connected: instagram.some((connection) => connection.status === "connected"),
        connections: instagram,
      },
      tiktok: {
        connected: tiktok.some((connection) => connection.status === "connected"),
        connections: tiktok,
      },
      fanvue: {
        connected: fanvue.some((connection) => connection.status === "connected"),
        connections: fanvue,
      },
      telegram: {
        connected: telegramConnected,
        connections: telegramConnected
          ? [
              {
                id: "telegram",
                provider: "telegram",
                providerAccountId: String(profile?.telegram_chat_id),
                username: null,
                displayName: "Telegram reminders",
                avatarUrl: null,
                status: "connected",
                scopes: [],
                tokenExpiresAt: null,
                refreshTokenExpiresAt: null,
                updatedAt: new Date().toISOString(),
                metadata: {},
                profile: null,
                instagramConnectionId: null,
                instagramUserId: null,
                instagramUsername: null,
                accountType: null,
              },
            ]
          : [],
      },
    })
  } catch (error) {
    console.error("[social-connections/status] GET exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
