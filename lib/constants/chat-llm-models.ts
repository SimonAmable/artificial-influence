import type { GoogleLanguageModelOptions } from "@ai-sdk/google"

/**
 * Creative chat model tiers routed through Vercel AI Gateway.
 * Canonical model ids stay server-facing while UI only shows tier labels.
 * @see https://vercel.com/ai-gateway/models/gemini-2.5-flash
 * @see https://vercel.com/ai-gateway/models/grok-4.1-fast-reasoning
 * @see https://vercel.com/ai-gateway/models/gemini-3.1-flash-lite-preview
 */
export const DEFAULT_CHAT_GATEWAY_MODEL = "google/gemini-3.1-flash-lite-preview" as const

type ChatGatewayTier = "fast" | "balanced" | "max"

type ChatGatewayProviderOptions = {
  google?: GoogleLanguageModelOptions
}

export type ChatGatewayModelOption = {
  id: string
  tier: ChatGatewayTier
  label: "Fast" | "Balanced" | "Max"
  description: string
  iconPath: string
  legacyIds?: readonly string[]
  providerOptions?: ChatGatewayProviderOptions
}

export const CHAT_GATEWAY_MODEL_OPTIONS: readonly ChatGatewayModelOption[] = [
  {
    id: "google/gemini-2.5-flash",
    tier: "fast",
    label: "Fast",
    description: "Quick answers for everyday chats, brainstorming, and lightweight tasks.",
    iconPath: "/logo-fast.svg",
    providerOptions: {
      google: {
        thinkingConfig: {
          includeThoughts: true,
          thinkingBudget: 2048,
        },
      } satisfies GoogleLanguageModelOptions,
    },
  },
  {
    id: "xai/grok-4.1-fast-reasoning",
    tier: "balanced",
    label: "Balanced",
    description: "The best mix of speed and depth for most conversations and creative work.",
    iconPath: "/logo-balanced.svg",
    legacyIds: ["xai/grok-4.1-fast-non-reasoning"],
    // Do not pass reasoningEffort for Grok 4.x / 4.1: xAI rejects unsupported models with
    // "Invalid arguments passed to the model" (reasoning is intrinsic to these variants).
  },
  {
    id: "google/gemini-3.1-flash-lite-preview",
    tier: "max",
    label: "Max",
    description: "Stronger reasoning for more complex planning, deeper research, and bigger asks.",
    iconPath: "/logo-max.svg",
    providerOptions: {
      google: {
        thinkingConfig: {
          includeThoughts: true,
          thinkingLevel: "high",
        },
      } satisfies GoogleLanguageModelOptions,
    },
  },
] as const

const CHAT_GATEWAY_MODEL_BY_ID = new Map<string, ChatGatewayModelOption>()

for (const option of CHAT_GATEWAY_MODEL_OPTIONS) {
  CHAT_GATEWAY_MODEL_BY_ID.set(option.id, option)

  for (const legacyId of option.legacyIds ?? []) {
    CHAT_GATEWAY_MODEL_BY_ID.set(legacyId, option)
  }
}

const CHAT_GATEWAY_MODEL_IDS = new Set<string>(CHAT_GATEWAY_MODEL_BY_ID.keys())

export function getChatGatewayModelOption(model: string | undefined | null): ChatGatewayModelOption {
  if (model) {
    const option = CHAT_GATEWAY_MODEL_BY_ID.get(model)
    if (option) {
      return option
    }
  }

  return CHAT_GATEWAY_MODEL_OPTIONS.find((option) => option.id === DEFAULT_CHAT_GATEWAY_MODEL) ?? CHAT_GATEWAY_MODEL_OPTIONS[0]
}

/**
 * Normalizes legacy stored ids to the canonical tier-backed model id used by current selectors.
 */
export function normalizeChatGatewayModelSelection(model: string | undefined | null): string {
  return getChatGatewayModelOption(model).id
}

export function getChatGatewayModelProviderOptions(
  model: string | undefined | null,
): ChatGatewayProviderOptions | undefined {
  return getChatGatewayModelOption(model).providerOptions
}

export function resolveChatGatewayModel(model: string | undefined): string {
  if (model && CHAT_GATEWAY_MODEL_IDS.has(model)) {
    return normalizeChatGatewayModelSelection(model)
  }

  return DEFAULT_CHAT_GATEWAY_MODEL
}
