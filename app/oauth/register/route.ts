import { NextResponse } from "next/server"

import { hashToken, randomToken } from "@/lib/mcp/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const supabase = createServiceRoleClient()
    if (!supabase) {
      return NextResponse.json({ error: "MCP OAuth is not configured" }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const redirectUris = Array.isArray(body.redirect_uris)
      ? body.redirect_uris.filter((uri: unknown): uri is string => typeof uri === "string")
      : []

    if (redirectUris.length === 0) {
      return NextResponse.json({ error: "redirect_uris is required" }, { status: 400 })
    }

    const tokenEndpointAuthMethod =
      body.token_endpoint_auth_method === "client_secret_post" ? "client_secret_post" : "none"
    const clientId = randomToken("unican_mcp_client_")
    const clientSecret =
      tokenEndpointAuthMethod === "client_secret_post"
        ? randomToken("unican_mcp_client_secret_")
        : null

    const { error } = await supabase.from("mcp_oauth_clients").insert({
      client_id: clientId,
      client_secret_hash: clientSecret ? hashToken(clientSecret) : null,
      client_name: typeof body.client_name === "string" ? body.client_name.slice(0, 120) : "MCP Client",
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: tokenEndpointAuthMethod,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        client_id: clientId,
        client_secret: clientSecret || undefined,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        redirect_uris: redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: tokenEndpointAuthMethod,
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid registration request" },
      { status: 400 },
    )
  }
}
