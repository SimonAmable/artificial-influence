import { toast } from "sonner"

export const OPEN_PRICING_PLANS_EVENT = "unican:open-pricing-plans"

export type PricingPlansModalTab = "monthly" | "yearly" | "one-time" | "enterprise"

export type OpenPricingPlansModalDetail = {
  tab?: PricingPlansModalTab
}

type CreditsUpsellToastOptions = {
  message: string
  description?: string
  toastId?: string
  delayMs?: number
}

export function openPricingPlansModal(detail?: OpenPricingPlansModalDetail) {
  if (typeof window === "undefined") return

  window.dispatchEvent(
    new CustomEvent<OpenPricingPlansModalDetail>(OPEN_PRICING_PLANS_EVENT, {
      detail: detail ?? {},
    })
  )
}

export function showCreditsUpsellToast({
  message,
  description = "Upgrade your plan to continue.",
  toastId = "credits-upsell",
  delayMs = 180,
}: CreditsUpsellToastOptions) {
  if (typeof window === "undefined") return

  openPricingPlansModal()
  toast.dismiss(toastId)

  window.setTimeout(() => {
    toast.error(message, {
      id: toastId,
      description,
      action: undefined,
    })
  }, delayMs)
}
