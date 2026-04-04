"use client"

import { useStore } from "@xyflow/react"

/** True when 2+ nodes are selected in the flow store (hide per-node toolbars). */
export function useFlowMultiSelectActive(): boolean {
  return useStore(
    (state) => {
      let count = 0
      for (const [, node] of state.nodeLookup) {
        if (node.selected) {
          count += 1
          if (count > 1) return true
        }
      }
      return false
    },
    (a, b) => a === b
  )
}
