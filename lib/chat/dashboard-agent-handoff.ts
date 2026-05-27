import type { AttachedRef } from "@/lib/commands/types"

export const DASHBOARD_AGENT_HANDOFF_STORAGE_KEY = "unican:dashboard-agent-handoff"

export type DashboardAgentHandoff = {
  prompt: string
  attachedRefs: AttachedRef[]
  model: string
}

export function saveDashboardAgentHandoff(handoff: DashboardAgentHandoff): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(DASHBOARD_AGENT_HANDOFF_STORAGE_KEY, JSON.stringify(handoff))
}

export function consumeDashboardAgentHandoff(): DashboardAgentHandoff | null {
  if (typeof window === "undefined") return null

  const raw = sessionStorage.getItem(DASHBOARD_AGENT_HANDOFF_STORAGE_KEY)
  if (!raw) return null

  sessionStorage.removeItem(DASHBOARD_AGENT_HANDOFF_STORAGE_KEY)

  try {
    return JSON.parse(raw) as DashboardAgentHandoff
  } catch {
    return null
  }
}
