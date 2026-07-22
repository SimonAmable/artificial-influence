import type { FanvueCreditItemKey, FanvuePlanKey } from "@/lib/fanvue/app-store"
import {
  getFanvueCreditItemUuid,
  getFanvuePlanUuid,
} from "@/lib/fanvue/app-store"

/** Monthly credit grants per Fanvue plan (Presence Studio). */
export const FANVUE_MONTHLY_CREDITS: Record<FanvuePlanKey, number> = {
  free: 10,
  starter: 200,
  pro: 1000,
}

/** Fanvue App Store list prices in USD (must match Builder). */
export const FANVUE_PLAN_PRICES_USD: Record<Exclude<FanvuePlanKey, "free">, number> = {
  starter: 9,
  pro: 39,
}

export const FANVUE_CREDIT_PACK_PRICES_USD: Record<FanvueCreditItemKey, number> = {
  "200": 10,
  "500": 25,
  "1000": 50,
  "2000": 99.99,
}

export function resolveFanvuePlanKeyFromUuid(planUuid: string | null | undefined): FanvuePlanKey | null {
  if (!planUuid) return null
  const normalized = planUuid.trim().toLowerCase()
  const entries: FanvuePlanKey[] = ["free", "starter", "pro"]
  for (const key of entries) {
    const envUuid = getFanvuePlanUuid(key)
    if (envUuid && envUuid.toLowerCase() === normalized) {
      return key
    }
  }
  return null
}

export function resolveFanvueCreditItemKeyFromUuid(
  itemUuid: string | null | undefined
): FanvueCreditItemKey | null {
  if (!itemUuid) return null
  const normalized = itemUuid.trim().toLowerCase()
  const entries: FanvueCreditItemKey[] = ["200", "500", "1000", "2000"]
  for (const key of entries) {
    const envUuid = getFanvueCreditItemUuid(key)
    if (envUuid && envUuid.toLowerCase() === normalized) {
      return key
    }
  }
  return null
}

export function creditsForFanvuePlanUuid(planUuid: string | null | undefined): number {
  const key = resolveFanvuePlanKeyFromUuid(planUuid)
  if (!key) return 0
  return FANVUE_MONTHLY_CREDITS[key]
}

export function creditsForFanvueItemUuid(itemUuid: string | null | undefined): number {
  const key = resolveFanvueCreditItemKeyFromUuid(itemUuid)
  if (!key) return 0
  return Number(key)
}

export function fanvuePlanDisplayName(planKey: FanvuePlanKey): string {
  switch (planKey) {
    case "free":
      return "Free"
    case "starter":
      return "Starter"
    case "pro":
      return "Pro"
    default: {
      const _exhaustive: never = planKey
      return _exhaustive
    }
  }
}

export function fanvueExternalSubscriptionId(subscriptionId: string): string {
  return `fanvue:${subscriptionId}`
}
