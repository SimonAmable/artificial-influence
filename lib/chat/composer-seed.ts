export const AGENT_COMPOSER_SEED_STORAGE_KEY = "unican:agent-composer-seed"
export const AGENT_COMPOSER_SEED_EVENT = "agent-composer-seed"

type ComposerSeedPayload = {
  prompt: string
}

function readPrompt(raw: unknown): string | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (raw && typeof raw === "object" && "prompt" in raw) {
    const prompt = (raw as ComposerSeedPayload).prompt
    if (typeof prompt === "string") {
      const trimmed = prompt.trim()
      return trimmed.length > 0 ? trimmed : null
    }
  }

  return null
}

/** Prefill the agent composer without auto-sending. */
export function saveAgentComposerSeed(prompt: string): void {
  if (typeof window === "undefined") return

  const trimmed = prompt.trim()
  if (!trimmed) return

  const payload: ComposerSeedPayload = { prompt: trimmed }
  sessionStorage.setItem(AGENT_COMPOSER_SEED_STORAGE_KEY, JSON.stringify(payload))
  window.dispatchEvent(
    new CustomEvent(AGENT_COMPOSER_SEED_EVENT, {
      detail: payload,
    }),
  )
}

export function consumeAgentComposerSeed(): string | null {
  if (typeof window === "undefined") return null

  const raw = sessionStorage.getItem(AGENT_COMPOSER_SEED_STORAGE_KEY)
  if (!raw) return null

  sessionStorage.removeItem(AGENT_COMPOSER_SEED_STORAGE_KEY)

  try {
    return readPrompt(JSON.parse(raw) as unknown)
  } catch {
    return readPrompt(raw)
  }
}
