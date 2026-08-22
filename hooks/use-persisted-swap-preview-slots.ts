"use client"

import * as React from "react"
import {
  loadSwapPreviewSlots,
  saveSwapPreviewSlots,
  type MotionSwapPreviewSlot,
  type SwapPreviewSurface,
} from "@/lib/motion-copy/swap-preview-storage"

export function usePersistedSwapPreviewSlots(surface: SwapPreviewSurface) {
  const [slots, setSlots] = React.useState<MotionSwapPreviewSlot[]>(() =>
    loadSwapPreviewSlots(surface),
  )

  React.useEffect(() => {
    saveSwapPreviewSlots(surface, slots)
  }, [surface, slots])

  const removeSlot = React.useCallback((clientRequestId: string) => {
    setSlots((prev) => prev.filter((slot) => slot.clientRequestId !== clientRequestId))
  }, [])

  const updateSlot = React.useCallback(
    (clientRequestId: string, patch: Partial<MotionSwapPreviewSlot>) => {
      setSlots((prev) =>
        prev.map((slot) =>
          slot.clientRequestId === clientRequestId ? { ...slot, ...patch } : slot,
        ),
      )
    },
    [],
  )

  return {
    slots,
    setSlots,
    removeSlot,
    updateSlot,
  }
}
