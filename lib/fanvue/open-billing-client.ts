import type { FanvueCreditItemKey, FanvuePlanKey } from "@/lib/fanvue/app-store"

export type FanvueBillingRequest =
  | { kind: "listing" }
  | { kind: "plan"; plan: FanvuePlanKey }
  | { kind: "item"; item: FanvueCreditItemKey }

export async function fetchFanvueBillingUrl(params: FanvueBillingRequest): Promise<string> {
  const response = await fetch("/api/billing/fanvue/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })

  const data = (await response.json()) as { url?: string; error?: string }

  if (!response.ok || !data.url) {
    throw new Error(data.error || "Fanvue billing is not configured yet.")
  }

  return data.url
}
