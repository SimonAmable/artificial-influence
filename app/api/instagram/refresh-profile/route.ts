import { NextResponse } from "next/server"

import { decryptAutopostToken } from "@/lib/autopost/crypto"
import {
  fetchInstagramMeForLink,
  parseSavedProfileFromMetadata,
  type InstagramMeResponse,
  type InstagramSavedProfile,
} from "@/lib/instagram/profile"
import { createClient } from "@/lib/supabase/server"

function parseConnectionId(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null
  }
  const id = (body as { connectionId?: unknown }).connectionId
  return typeof id === "string" && id.trim().length > 0 ? id.trim() : null
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ error: "Expected JSON body with connectionId." }, { status: 400 })
    }

    const connectionId = parseConnectionId(json)
    if (!connectionId) {
      return NextResponse.json({ error: "Expected connectionId (string)." }, { status: 400 })
    }

    const { data: row, error: rowError } = await supabase
      .from("instagram_connections")
      .select(
        "metadata, access_token_encrypted, token_expires_at, status, instagram_username, instagram_user_id"
      )
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (rowError) {
      console.error("[instagram/refresh-profile] query failed:", rowError)
      return NextResponse.json({ error: "Failed to load Instagram connection." }, { status: 500 })
    }

    if (!row || row.status !== "connected" || !row.access_token_encrypted) {
      return NextResponse.json({ error: "No connected Instagram account." }, { status: 400 })
    }

    if (row.token_expires_at) {
      const expires = new Date(row.token_expires_at).getTime()
      if (Number.isFinite(expires) && expires < Date.now()) {
        return NextResponse.json(
          { error: "Instagram access token expired. Reconnect your account." },
          { status: 400 }
        )
      }
    }

    let accessToken: string
    try {
      accessToken = decryptAutopostToken(row.access_token_encrypted)
    } catch (decryptError) {
      console.error("[instagram/refresh-profile] decrypt failed:", decryptError)
      return NextResponse.json({ error: "Could not read Instagram credentials." }, { status: 500 })
    }

    let me: InstagramMeResponse
    let savedProfile: InstagramSavedProfile
    try {
      const fetched = await fetchInstagramMeForLink(accessToken)
      me = fetched.me
      savedProfile = fetched.profile
    } catch (apiError) {
      console.error("[instagram/refresh-profile] Instagram /me failed:", apiError)
      return NextResponse.json(
        {
          error:
            apiError instanceof Error ? apiError.message : "Could not refresh profile from Instagram.",
        },
        { status: 502 }
      )
    }

    const baseMeta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? { ...(row.metadata as Record<string, unknown>) }
        : {}

    const nextMetadata = {
      ...baseMeta,
      account_type: me.account_type ?? baseMeta.account_type ?? null,
      profile: savedProfile,
    }

    const { error: updateError } = await supabase
      .from("instagram_connections")
      .update({
        instagram_username: me.username ?? row.instagram_username,
        instagram_user_id: me.id ?? row.instagram_user_id,
        metadata: nextMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .eq("status", "connected")

    if (updateError) {
      console.error("[instagram/refresh-profile] update failed:", updateError)
      return NextResponse.json({ error: "Failed to save profile." }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      profile: parseSavedProfileFromMetadata(nextMetadata),
    })
  } catch (error) {
    console.error("[instagram/refresh-profile] POST exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
