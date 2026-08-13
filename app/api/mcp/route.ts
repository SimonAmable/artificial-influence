import { NextResponse } from "next/server"

import {
  bearerChallenge,
  McpAuthError,
  requireMcpAuth,
  type McpScope,
} from "@/lib/mcp/auth"
import { formatMcpToolResult } from "@/lib/mcp/content/format-tool-result"
import { parseClientUiCapability } from "@/lib/mcp/protocol/client-capabilities"
import { isAllowedMcpOrigin } from "@/lib/mcp/protocol/allowed-origins"
import {
  auditMcpToolCall,
  callMcpTool,
  getToolDefinition,
  MCP_TOOLS,
  serializeToolDefinition,
} from "@/lib/mcp/tools"
import {
  getUnicanMediaWidgetResource,
  UNICAN_MEDIA_WIDGET_MIME_TYPE,
  UNICAN_MEDIA_WIDGET_URI,
} from "@/lib/mcp/widget"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type JsonRpcRequest = {
  id?: string | number | null
  jsonrpc?: string
  method?: string
  params?: Record<string, unknown>
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  if (!isAllowedMcpOrigin(request, requestUrl)) {
    return NextResponse.json({ error: "Origin is not allowed" }, { status: 403 })
  }

  try {
    await requireMcpAuth(request.headers)
    return new Response(`event: ready\ndata: {"status":"ready"}\n\n`, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
      },
    })
  } catch (error) {
    return unauthorized(requestUrl, error)
  }
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url)
  if (!isAllowedMcpOrigin(request, requestUrl)) {
    return NextResponse.json({ error: "Origin is not allowed" }, { status: 403 })
  }

  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(jsonRpcError(null, -32700, "Parse error"), { status: 400 })
  }

  const items = Array.isArray(payload) ? payload : [payload]
  const responses = []

  for (const item of items) {
    const response = await handleRpcRequest(request, requestUrl, item as JsonRpcRequest)
    if (response !== null) responses.push(response)
  }

  if (Array.isArray(payload)) {
    return NextResponse.json(responses)
  }

  if (responses.length === 0) {
    return new Response(null, { status: 202 })
  }

  return NextResponse.json(responses[0])
}

async function handleRpcRequest(
  request: Request,
  requestUrl: URL,
  rpc: JsonRpcRequest,
) {
  const id = rpc?.id ?? null
  const method = rpc?.method

  if (!method) {
    return jsonRpcError(id, -32600, "Invalid Request")
  }

  if (method.startsWith("notifications/")) {
    return null
  }

  try {
    if (method === "initialize") {
      await requireMcpAuth(request.headers)
      const clientUi = parseClientUiCapability(rpc.params)
      return jsonRpcResult(id, {
        protocolVersion: "2025-11-25",
        capabilities: {
          resources: {},
          tools: {},
          extensions: {
            "io.modelcontextprotocol/ui": {
              mimeTypes: [UNICAN_MEDIA_WIDGET_MIME_TYPE],
            },
          },
        },
        serverInfo: {
          name: "unican-mcp",
          version: "0.3.0",
          ...(clientUi ? { clientUiSupported: true } : {}),
        },
      })
    }

    if (method === "ping") {
      await requireMcpAuth(request.headers)
      return jsonRpcResult(id, {})
    }

    if (method === "tools/list") {
      await requireMcpAuth(request.headers)
      return jsonRpcResult(id, {
        tools: MCP_TOOLS.map((tool) => serializeToolDefinition(tool)),
      })
    }

    if (method === "resources/list") {
      await requireMcpAuth(request.headers)
      return jsonRpcResult(id, {
        resources: [
          {
            uri: UNICAN_MEDIA_WIDGET_URI,
            name: "unican-media-output",
            title: "UniCan media output",
            description: "Interactive output for UniCan media and model tools.",
            mimeType: UNICAN_MEDIA_WIDGET_MIME_TYPE,
          },
        ],
      })
    }

    if (method === "resources/read") {
      await requireMcpAuth(request.headers)
      const uri = typeof rpc.params?.uri === "string" ? rpc.params.uri : ""
      if (uri !== UNICAN_MEDIA_WIDGET_URI) {
        return jsonRpcError(id, -32602, `Unknown resource: ${uri}`)
      }

      return jsonRpcResult(id, {
        contents: [getUnicanMediaWidgetResource()],
      })
    }

    if (method === "tools/call") {
      const name = String(rpc.params?.name || "")
      const args =
        rpc.params?.arguments && typeof rpc.params.arguments === "object"
          ? (rpc.params.arguments as Record<string, unknown>)
          : {}
      const tool = getToolDefinition(name)
      if (!tool) {
        return jsonRpcError(id, -32602, `Unknown tool: ${name}`)
      }

      const auth = await requireMcpAuth(request.headers, tool.scopes as McpScope[])
      try {
        const result = await callMcpTool({
          auth,
          args,
          name,
          origin: requestUrl.origin,
        })
        const formatted = formatMcpToolResult(name, result)
        await auditMcpToolCall({
          auth,
          toolName: name,
          status: "success",
          request: args,
          response: result as Record<string, unknown>,
          generationId: extractGenerationId(result),
        })
        return jsonRpcResult(id, {
          content: formatted.content,
          structuredContent: result,
          ...(formatted.isError ? { isError: true } : {}),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Tool call failed"
        await auditMcpToolCall({
          auth,
          toolName: name,
          status: "error",
          request: args,
          response: {},
          errorMessage: message,
        })
        return jsonRpcResult(id, {
          isError: true,
          content: [
            {
              type: "text",
              text: message,
            },
          ],
        })
      }
    }

    return jsonRpcError(id, -32601, "Method not found")
  } catch (error) {
    if (error instanceof McpAuthError) {
      return jsonRpcError(id, error.status === 403 ? -32003 : -32001, error.message)
    }
    return jsonRpcError(id, -32603, error instanceof Error ? error.message : "Internal error")
  }
}

function unauthorized(requestUrl: URL, error: unknown) {
  const status = error instanceof McpAuthError ? error.status : 401
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unauthorized" },
    {
      status,
      headers: {
        "WWW-Authenticate": bearerChallenge(requestUrl),
      },
    },
  )
}

function jsonRpcResult(id: string | number | null, result: unknown) {
  return { jsonrpc: "2.0", id, result }
}

function jsonRpcError(id: string | number | null, code: number, message: string) {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message },
  }
}

function extractGenerationId(result: unknown) {
  if (!result || typeof result !== "object") return null
  const value = (result as { generationId?: unknown }).generationId
  return typeof value === "string" ? value : null
}
