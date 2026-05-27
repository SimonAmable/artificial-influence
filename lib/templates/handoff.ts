import type { UIMessage } from "ai"

export const PENDING_TEMPLATE_HANDOFF_KEY = "pendingTemplateHandoff"

export interface PendingTemplateHandoff {
  threadId: string
  templateSlug: string
  openingMessage: UIMessage
}

export function setPendingTemplateHandoff(payload: PendingTemplateHandoff): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(PENDING_TEMPLATE_HANDOFF_KEY, JSON.stringify(payload))
}

export function consumePendingTemplateHandoff(threadId: string): PendingTemplateHandoff | null {
  if (typeof window === "undefined") return null

  const raw = sessionStorage.getItem(PENDING_TEMPLATE_HANDOFF_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as PendingTemplateHandoff
    if (parsed.threadId !== threadId) return null
    sessionStorage.removeItem(PENDING_TEMPLATE_HANDOFF_KEY)
    return parsed
  } catch {
    sessionStorage.removeItem(PENDING_TEMPLATE_HANDOFF_KEY)
    return null
  }
}

export function clearPendingTemplateHandoff(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(PENDING_TEMPLATE_HANDOFF_KEY)
}
