"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BrandKitEditor } from "@/components/brand-kit/brand-kit-editor"

export type BrandKitModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BrandKitModal({ open, onOpenChange }: BrandKitModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto border-border bg-background p-4 text-foreground sm:max-w-5xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Your Business DNA</DialogTitle>
          <DialogDescription>Edit your brand snapshot for campaigns and the Creative Agent.</DialogDescription>
        </DialogHeader>
        <BrandKitEditor variant="dialog" className="gap-4" />
      </DialogContent>
    </Dialog>
  )
}
