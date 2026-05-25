import type { Tool } from "ai"

/**
 * xAI Grok via AI Gateway rejects some tool request fields that other providers accept.
 * In particular, OpenAI-style `strict: true` on tools triggers
 * "Invalid arguments passed to the model" before the first token.
 */
export function isXaiChatGatewayModel(model: string): boolean {
  return model.startsWith("xai/")
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
    const { strict: _strict, ...toolWithoutStrict } = chatTool as Tool & { strict?: boolean }
    adapted[name as keyof T] = toolWithoutStrict as T[keyof T]
  }

  return adapted
}
