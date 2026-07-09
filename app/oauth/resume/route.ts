import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import {
  isMcpOAuthContinuationPath,
  MCP_OAUTH_RETURN_COOKIE,
} from "@/lib/mcp/oauth-login-state"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${requestUrl.origin}/login?next=/oauth/resume`, 302)
  }

  const cookieStore = await cookies()
  const pendingAuthorizePath = cookieStore.get(MCP_OAUTH_RETURN_COOKIE)?.value

  if (
    !pendingAuthorizePath ||
    !pendingAuthorizePath.startsWith("/") ||
    !isMcpOAuthContinuationPath(pendingAuthorizePath)
  ) {
    return NextResponse.json(
      { error: "No pending MCP authorization request was found. Start the connector flow again." },
      { status: 400 },
    )
  }

  return NextResponse.redirect(`${requestUrl.origin}${pendingAuthorizePath}`, 302)
}
