import "server-only"

import { FanvueApiError, fanvueApiRequest } from "@/lib/fanvue/client"
import { getFanvueAppUuid } from "@/lib/fanvue/app-store"
import { getValidFanvueAccessToken } from "@/lib/fanvue/token-service"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type FanvueAppSubscriptionStatus =
  | { status: "unconfigured" }
  | { status: "not_connected" }
  | { status: "not_live" }
  | { status: "ok"; subscription: unknown }

/**
 * Best-effort entitlement check via Fanvue App Store subscription API.
 * Treats missing app UUID, disconnected Fanvue, or billing-not-live responses as non-fatal.
 */
export async function getFanvueAppSubscription(
  userId: string
): Promise<FanvueAppSubscriptionStatus> {
  const appUuid = getFanvueAppUuid()
  if (!appUuid) {
    return { status: "unconfigured" }
  }

  const supabase = createServiceRoleClient()
  if (!supabase) {
    return { status: "unconfigured" }
  }

  const { data: connection } = await supabase
    .from("social_connections")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "fanvue")
    .eq("status", "connected")
    .maybeSingle()

  if (!connection?.id) {
    return { status: "not_connected" }
  }

  try {
    const token = await getValidFanvueAccessToken(supabase, {
      connectionId: connection.id,
      userId,
    })

    const subscription = await fanvueApiRequest<unknown>({
      accessToken: token.accessToken,
      path: `/apps/${appUuid}/subscription/me`,
    })
    return { status: "ok", subscription }
  } catch (error) {
    if (error instanceof FanvueApiError && (error.status === 404 || error.status === 503)) {
      return { status: "not_live" }
    }
    throw error
  }
}
