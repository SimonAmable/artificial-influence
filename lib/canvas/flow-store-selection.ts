import type { Node } from "@xyflow/react"

export type FlowSelectedSlice = { key: string; nodes: Node[] }

/** Selected nodes as React Flow's internal store sees them (matches selection outlines). */
export function selectSelectedNodesFromFlowStore(state: {
  nodeLookup: Map<string, { selected: boolean; internals: { userNode: Node } }>
}): Node[] {
  const out: Node[] = []
  for (const [, n] of state.nodeLookup) {
    if (n.selected) out.push(n.internals.userNode)
  }
  return out
}

/** Stable store slice: same `key` until the set of selected node ids changes. */
export function selectFlowSelectedNodesWithKey(state: {
  nodeLookup: Map<string, { selected: boolean; internals: { userNode: Node } }>
}): FlowSelectedSlice {
  const nodes = selectSelectedNodesFromFlowStore(state)
  const key =
    nodes.length === 0
      ? ""
      : [...nodes]
          .map((n) => n.id)
          .sort()
          .join("\0")
  return { key, nodes }
}

export function equalFlowSelectionKey(a: FlowSelectedSlice, b: FlowSelectedSlice): boolean {
  return a.key === b.key
}
