/**
 * Creative chat models routed through Vercel AI Gateway.
 * @see https://vercel.com/ai-gateway/models/gemini-3.1-flash-lite-preview
 * @see https://vercel.com/ai-gateway/models/grok-4.1-fast-non-reasoning
 */
export const DEFAULT_CHAT_GATEWAY_MODEL = "google/gemini-3.1-flash-lite-preview" as const

export const CHAT_GATEWAY_MODEL_OPTIONS = [
  {
    id: "google/gemini-3.1-flash-lite-preview",
    label: "Gemini 3.1 Lite",
    description: "Best for fast, high-quality chat and image understanding. Google's leading multimodal model, ideal for most creative chats.",
  },
  {
    id: "xai/grok-4.1-fast-non-reasoning",
    label: "Grok 4.1 Fast",
    description: "Quickest Grok responses. Great when you want speedy answers and don't need deep reasoning.",
  },
] as const

const CHAT_GATEWAY_MODEL_IDS = new Set<string>(
  CHAT_GATEWAY_MODEL_OPTIONS.map((option) => option.id),
)

export function resolveChatGatewayModel(model: string | undefined): string {
  if (model && CHAT_GATEWAY_MODEL_IDS.has(model)) {
    return model
  }
  return DEFAULT_CHAT_GATEWAY_MODEL
}
