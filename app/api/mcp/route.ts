import { NextResponse } from "next/server"

import {
  bearerChallenge,
  McpAuthError,
  requireMcpAuth,
  type McpScope,
} from "@/lib/mcp/auth"
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

const DEFAULT_ALLOWED_ORIGINS = [
  "https://chatgpt.com",
  "https://chat.openai.com",
  "https://platform.openai.com",
  "http://localhost:6274",
  "http://127.0.0.1:6274",
]

type JsonRpcRequest = {
  id?: string | number | null
  jsonrpc?: string
  method?: string
  params?: Record<string, unknown>
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  if (!isAllowedOrigin(request, requestUrl)) {
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
  if (!isAllowedOrigin(request, requestUrl)) {
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
          version: "0.2.0",
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
        await auditMcpToolCall({
          auth,
          toolName: name,
          status: "success",
          request: args,
          response: result as Record<string, unknown>,
          generationId: extractGenerationId(result),
        })
        return jsonRpcResult(id, {
          content: formatToolContent(name, result),
          structuredContent: result,
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

function formatToolContent(toolName: string, result: unknown) {
  return [
    {
      type: "text",
      text: summarizeToolResult(toolName, result),
    },
  ]
}

function summarizeToolResult(toolName: string, result: unknown) {
  if (!result || typeof result !== "object") return `${toolName} completed.`
  const value = result as Record<string, unknown>

  if (Array.isArray(value.models)) {
    return `Listed ${value.models.length} active UniCan model${value.models.length === 1 ? "" : "s"}.`
  }

  if (Array.isArray(value.generations)) {
    return `Loaded ${value.generations.length} generation${value.generations.length === 1 ? "" : "s"}.`
  }

  if (value.generation && typeof value.generation === "object") {
    const generation = value.generation as Record<string, unknown>
    const status = typeof generation.status === "string" ? generation.status : "ready"
    const type = typeof generation.type === "string" ? generation.type : "generation"
    const url = typeof generation.url === "string" ? generation.url : null
    if (status === "completed" && url) return `Your ${type} is ready: ${url}`
    if (status === "failed") return `This ${type} could not be completed.`
    return `Your ${type} is still being created.`
  }

  if (Array.isArray(value.items)) {
    const status = typeof value.status === "string" ? value.status : "ready"
    const type = typeof value.type === "string" ? value.type : "media"
    const firstItem = value.items[0]
    const firstUrl = firstItem && typeof firstItem === "object"
      ? (firstItem as Record<string, unknown>).mediaUrl || (firstItem as Record<string, unknown>).url
      : null
    if (status === "completed" && typeof firstUrl === "string") {
      return `Your ${type} is ready: ${firstUrl}`
    }
    if (status === "failed") return `This ${type} could not be completed.`
    if (["pending", "queued", "processing", "starting", "in_progress"].includes(status)) {
      return `Your ${type} is being created.`
    }
    return `${toolName} completed.`
  }

  if (value.account && typeof value.account === "object") {
    return "Connected UniCan account loaded."
  }

  return `${toolName} completed.`
}

function isAllowedOrigin(request: Request, requestUrl: URL) {
  const origin = request.headers.get("origin")
  if (!origin) return true

  const configuredOrigins = (process.env.MCP_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
  const allowed = new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins])
  allowed.add(requestUrl.origin)

  return allowed.has(origin)
}
