/**
 * Fanvue App Store listing + checkout deeplink helpers.
 * @see https://api.fanvue.com/docs/app-store/deeplinks.md
 */

export type FanvuePlanKey = "free" | "starter" | "pro"

export type FanvueCreditItemKey = "200" | "500" | "1000" | "2000"

const FANVUE_APP_STORE_BASE = "https://www.fanvue.com/app-store/details"

function trimEnv(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

function readEnv(name: string): string | null {
  return trimEnv(process.env[`NEXT_PUBLIC_${name}`]) ?? trimEnv(process.env[name])
}

export function getFanvueAppUuid(): string | null {
  return readEnv("FANVUE_APP_UUID")
}

export function getFanvueAppStoreListingUrl(): string | null {
  const appUuid = getFanvueAppUuid()
  if (!appUuid) return null
  return `${FANVUE_APP_STORE_BASE}/${appUuid}`
}

export function getFanvuePlanUuid(plan: FanvuePlanKey): string | null {
  switch (plan) {
    case "free":
      return readEnv("FANVUE_PLAN_FREE_UUID")
    case "starter":
      return readEnv("FANVUE_PLAN_STARTER_UUID")
    case "pro":
      return readEnv("FANVUE_PLAN_PRO_UUID")
    default: {
      const _exhaustive: never = plan
      return _exhaustive
    }
  }
}

export function getFanvueCreditItemUuid(item: FanvueCreditItemKey): string | null {
  switch (item) {
    case "200":
      return readEnv("FANVUE_ITEM_CREDITS_200_UUID")
    case "500":
      return readEnv("FANVUE_ITEM_CREDITS_500_UUID")
    case "1000":
      return readEnv("FANVUE_ITEM_CREDITS_1000_UUID")
    case "2000":
      return readEnv("FANVUE_ITEM_CREDITS_2000_UUID")
    default: {
      const _exhaustive: never = item
      return _exhaustive
    }
  }
}

/** Listing URL with optional plan preselected / checkout action. */
export function getFanvueCheckoutUrl(
  plan: FanvuePlanKey,
  options?: { action?: "checkout" }
): string | null {
  const listing = getFanvueAppStoreListingUrl()
  const planUuid = getFanvuePlanUuid(plan)
  if (!listing || !planUuid) return null

  const params = new URLSearchParams({ plan: planUuid })
  if (options?.action === "checkout") {
    params.set("action", "checkout")
  }
  return `${listing}?${params.toString()}`
}

/** Map internal pricing plan ids (starter / plus) to Fanvue plan keys. */
export function mapInternalPlanToFanvue(planId: string): FanvuePlanKey | null {
  const base = planId.replace(/-(monthly|yearly)$/, "")
  switch (base) {
    case "free":
      return "free"
    case "starter":
      return "starter"
    case "plus":
    case "pro":
      return "pro"
    default:
      return null
  }
}

/** Listing URL with optional one-time credit item preselected. */
export function getFanvueCreditCheckoutUrl(
  item: FanvueCreditItemKey,
  options?: { action?: "checkout" }
): string | null {
  const listing = getFanvueAppStoreListingUrl()
  const itemUuid = getFanvueCreditItemUuid(item)
  if (!listing || !itemUuid) return null

  const params = new URLSearchParams({ item: itemUuid })
  if (options?.action === "checkout") {
    params.set("action", "checkout")
  }
  return `${listing}?${params.toString()}`
}

export function mapCreditsToFanvueItem(credits: number): FanvueCreditItemKey | null {
  switch (credits) {
    case 200:
      return "200"
    case 500:
      return "500"
    case 1000:
      return "1000"
    case 2000:
      return "2000"
    default:
      return null
  }
}
