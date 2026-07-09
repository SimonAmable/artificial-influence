import { NextResponse } from "next/server"

import { hashToken } from "@/lib/mcp/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const supabase = createServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: "MCP OAuth is not configured" }, { status: 500 })
  }

  const params = new URLSearchParams(await request.text())
  const token = params.get("token")
  if (!token) {
    return NextResponse.json({}, { status: 200 })
  }

  const tokenHash = hashToken(token)
  await supabase
    .from("mcp_oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .or(`access_token_hash.eq.${tokenHash},refresh_token_hash.eq.${tokenHash}`)

  return NextResponse.json({}, { status: 200 })
}
