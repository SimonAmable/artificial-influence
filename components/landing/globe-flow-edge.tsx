import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react"

export function GlobeFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25,
  })

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1.5 }} />

      <path
        d={edgePath}
        fill="none"
        stroke="rgba(255,255,255,0.8)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="20 200"
        style={{ filter: "blur(1.5px) drop-shadow(0 0 4px rgba(255,255,255,0.6))" }}
      >
        <animate attributeName="stroke-dashoffset" from="0" to="-220" dur="3s" repeatCount="indefinite" />
      </path>
    </>
  )
}
