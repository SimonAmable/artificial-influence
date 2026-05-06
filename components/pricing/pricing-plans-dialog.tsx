"use client"

import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "@phosphor-icons/react"
import { PricingSection } from "@/components/landing/pricing-section"
import { Button } from "@/components/ui/button"
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog"

type PricingPlansDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PricingPlansDialog({ open, onOpenChange }: PricingPlansDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-background/80 supports-backdrop-filter:backdrop-blur-md" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex h-dvh w-screen flex-col bg-background outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Pricing plans</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Review subscription plans and credit packs to continue generating images.
          </DialogPrimitive.Description>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute top-4 right-4 z-[60] rounded-full"
            onClick={() => onOpenChange(false)}
            aria-label="Close pricing plans"
          >
            <XIcon className="size-4" />
          </Button>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <PricingSection embedded compact />
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
