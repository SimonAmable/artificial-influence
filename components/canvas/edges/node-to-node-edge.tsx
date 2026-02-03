"use client"

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react"

/**
 * Custom edge that connects from node edge to node edge,
 * rather than from handle to handle.
 * This allows for cleaner visual connections while keeping handles as indicators.
 */
export function NodeToNodeEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  id,
}: EdgeProps) {
  // Use bezier path for smooth curves connecting directly to handles
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  return (
    <BaseEdge
      path={edgePath}
      id={id}
      markerEnd="url(#react-flow__arrowclosed)"
    />
  )
}
