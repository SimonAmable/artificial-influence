import { toast } from "sonner"

export const OPEN_PRICING_PLANS_EVENT = "unican:open-pricing-plans"

type CreditsUpsellToastOptions = {
  message: string
  description?: string
  toastId?: string
  delayMs?: number
}

export function openPricingPlansModal() {
  if (typeof window === "undefined") return

  window.dispatchEvent(new CustomEvent(OPEN_PRICING_PLANS_EVENT))
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
