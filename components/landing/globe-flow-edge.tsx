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
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: "color-mix(in oklch, var(--foreground) 22%, transparent)",
          strokeWidth: 1.5,
        }}
      />

      <path
        d={edgePath}
        fill="none"
        stroke="color-mix(in oklch, var(--foreground) 48%, transparent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="20 200"
        style={{ filter: "blur(1.5px)" }}
      >
        <animate attributeName="stroke-dashoffset" from="0" to="-220" dur="3s" repeatCount="indefinite" />
      </path>
    </>
  )
}
