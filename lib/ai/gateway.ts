import { createGateway } from "ai"

export const AI_GATEWAY_CONFIG_ERROR =
  "AI Gateway is not configured. Set AI_GATEWAY_API_KEY or provision VERCEL_OIDC_TOKEN via Vercel."

export function hasAIGatewayCredentials(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim(),
  )
}

export function createAIGatewayProvider() {
  if (!hasAIGatewayCredentials()) {
    throw new Error(AI_GATEWAY_CONFIG_ERROR)
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim()
  return apiKey ? createGateway({ apiKey }) : createGateway()
}
