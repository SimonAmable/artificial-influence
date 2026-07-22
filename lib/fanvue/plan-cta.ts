import type { PlanCtaKind, PlanCtaState } from "@/lib/pricing-plan-cta"
import {
  fanvuePlanDisplayName,
  resolveFanvuePlanKeyFromUuid,
} from "@/lib/fanvue/billing-config"

const PLAN_TIER: Record<string, number> = {
  Free: 0,
  Starter: 1,
  Pro: 2,
  Plus: 2,
}

export function getFanvuePlanCtaState({
  planName,
  activePlanUuid,
  activePlanName,
  isLoggedIn,
}: {
  planName: string
  activePlanUuid: string | null
  activePlanName: string | null
  isLoggedIn: boolean
}): PlanCtaState {
  if (planName === "Free") {
    if (!isLoggedIn) {
      return { kind: "signup", label: "Start free" }
    }
    if (!activePlanUuid && (!activePlanName || activePlanName === "Free")) {
      return { kind: "current", label: "Current plan" }
    }
    return { kind: "inactive", label: "Paid plan active" }
  }

  if (!isLoggedIn) {
    return { kind: "checkout", label: `Get ${planName}` }
  }

  const activeKey = resolveFanvuePlanKeyFromUuid(activePlanUuid)
  const activeDisplay = activeKey
    ? fanvuePlanDisplayName(activeKey)
    : activePlanName

  if (activeDisplay === planName) {
    return { kind: "current", label: "Current plan" }
  }

  if (!activeDisplay || activeDisplay === "Free") {
    return { kind: "checkout", label: `Get ${planName}` }
  }

  const targetTier = PLAN_TIER[planName] ?? 0
  const currentTier = PLAN_TIER[activeDisplay] ?? 0

  if (targetTier > currentTier) {
    return { kind: "checkout", label: `Upgrade to ${planName}` }
  }

  if (targetTier < currentTier) {
    return { kind: "portal", label: "Manage billing" }
  }

  return { kind: "checkout", label: `Get ${planName}` }
}

export type { PlanCtaKind }
