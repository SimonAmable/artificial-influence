"use client"

import type { CallbackListener, PlayerRef } from "@remotion/player"
import { useCallback, useSyncExternalStore, type RefObject } from "react"

/**
 * Subscribes to the Remotion Player frame without forcing parent re-renders.
 * @see https://www.remotion.dev/docs/player/current-time
 */
export function useCurrentPlayerFrame(
  ref: RefObject<PlayerRef | null>
): number {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const { current } = ref
      if (!current) {
        return () => undefined
      }
      const updater: CallbackListener<"frameupdate"> = () => {
        onStoreChange()
      }
      current.addEventListener("frameupdate", updater)
      return () => {
        current.removeEventListener("frameupdate", updater)
      }
    },
    [ref]
  )

  return useSyncExternalStore(
    subscribe,
    () => ref.current?.getCurrentFrame() ?? 0,
    () => 0
  )
}
