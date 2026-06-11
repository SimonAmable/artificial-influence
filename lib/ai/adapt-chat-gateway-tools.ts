import type { JSONSchema7 } from "@ai-sdk/provider"
import { asSchema, jsonSchema, tool, type Tool } from "ai"

/**
 * xAI Grok via AI Gateway rejects tool payloads that other providers accept.
 * Common triggers: `strict: true`, JSON Schema constraint keywords, and
 * `items` defined as a tuple array.
 */
export function isXaiChatGatewayModel(model: string): boolean {
  return model.startsWith("xai/")
}

const XAI_STRIPPED_JSON_SCHEMA_KEYS = new Set([
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "minContains",
  "maxContains",
  "minProperties",
  "maxProperties",
  "pattern",
  "format",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "$schema",
  "discriminator",
])

export function stripXaiUnsupportedJsonSchema(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(stripXaiUnsupportedJsonSchema)
  }

  const record = value as Record<string, unknown>
  const stripped: Record<string, unknown> = {}

  for (const [key, nested] of Object.entries(record)) {
    if (XAI_STRIPPED_JSON_SCHEMA_KEYS.has(key)) {
      continue
    }

    if (key === "items" && Array.isArray(nested)) {
      continue
    }

    stripped[key] = stripXaiUnsupportedJsonSchema(nested)
  }

  return stripped
}

function adaptToolForXaiGateway(chatTool: Tool): Tool {
  const { strict, inputSchema, ...rest } = chatTool as Tool & { strict?: boolean }
  void strict
  const resolved = asSchema(inputSchema)
  const sanitized = stripXaiUnsupportedJsonSchema(resolved.jsonSchema) as JSONSchema7

  return tool({
    ...rest,
    inputSchema: jsonSchema(sanitized),
  })
}

export function adaptChatToolsForGatewayModel<T extends Record<string, Tool>>(
  tools: T,
  model: string,
): T {
  if (!isXaiChatGatewayModel(model)) {
    return tools
  }

  const adapted = {} as T

  for (const [name, chatTool] of Object.entries(tools)) {
    adapted[name as keyof T] = adaptToolForXaiGateway(chatTool) as T[keyof T]
  }

  return adapted
}
