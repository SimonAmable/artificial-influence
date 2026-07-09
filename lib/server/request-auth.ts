import type { NextRequest } from "next/server"

import { requireMcpAuth, type McpScope } from "@/lib/mcp/auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function getAuthenticatedRequestContext(
  request: NextRequest,
  mcpScopes: McpScope[] = [],
) {
  const authorization = request.headers.get("authorization") || ""

  if (/^Bearer\s+unican_mcp_/i.test(authorization)) {
    const serviceRole = createServiceRoleClient()
    if (!serviceRole) {
      throw new Error("MCP auth requires SUPABASE_SERVICE_ROLE_KEY")
    }

    try {
      const mcpAuth = await requireMcpAuth(request.headers, mcpScopes)
      return {
        supabase: serviceRole,
        user: mcpAuth.user,
        mcpAuth,
        error: null,
      }
    } catch (error) {
      return {
        supabase: serviceRole,
        user: null,
        mcpAuth: null,
        error: error instanceof Error ? error : new Error("Invalid MCP bearer token"),
      }
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      supabase,
      user: null,
      mcpAuth: null,
      error,
    }
  }

  return {
    supabase,
    user,
    mcpAuth: null,
    error: null,
  }
}
