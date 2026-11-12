"use client"

import * as React from "react"
import {
  loadWaveSpeedLoraSlots,
  saveWaveSpeedLoraSlots,
  type WaveSpeedLoraSlot,
} from "@/lib/image/wavespeed-loras"

export function useQwenImageLoras() {
  const [loras, setLorasState] = React.useState<WaveSpeedLoraSlot[]>([])
  const hydratedRef = React.useRef(false)

  React.useEffect(() => {
    setLorasState(loadWaveSpeedLoraSlots())
    hydratedRef.current = true
  }, [])

  const setLoras = React.useCallback((next: WaveSpeedLoraSlot[] | ((prev: WaveSpeedLoraSlot[]) => WaveSpeedLoraSlot[])) => {
    setLorasState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next
      if (hydratedRef.current) {
        saveWaveSpeedLoraSlots(resolved)
      }
      return resolved
    })
  }, [])

  return { loras, setLoras, hydrated: hydratedRef.current }
}
