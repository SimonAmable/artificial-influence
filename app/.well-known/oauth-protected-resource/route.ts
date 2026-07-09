import { NextResponse } from "next/server"

import { getMcpBaseUrl, getMcpEndpointUrl, MCP_SCOPES } from "@/lib/mcp/auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const baseUrl = getMcpBaseUrl(requestUrl)

  return NextResponse.json({
    resource: getMcpEndpointUrl(requestUrl),
    authorization_servers: [baseUrl],
    scopes_supported: MCP_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "Unican MCP",
  })
}
