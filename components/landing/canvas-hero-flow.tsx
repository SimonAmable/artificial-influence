"use client"

import * as React from "react"
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  useNodesState,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { canvasSeeds } from "@/lib/constants/landing-content"
import type { LandingMediaType } from "@/lib/types/landing"
import { GlobeFlowEdge } from "@/components/landing/globe-flow-edge"

type CanvasMediaNodeData = {
  label: string
  mediaType: LandingMediaType
  mediaSrc: string
}

const LABEL_HEIGHT = 36

function getMediaSize(src: string, mediaType: LandingMediaType): Promise<{ width: number; height: number }> {
  if (mediaType === "image") {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = reject
      image.src = src
    })
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight })
    video.onerror = reject
    video.src = src
  })
}

function constrainMediaSize(width: number, height: number) {
  const minWidth = 220
  const maxWidth = 380
  const minHeight = 130
  const maxHeight = 270

  let scaledWidth = width
  let scaledHeight = height

  const downScale = Math.min(maxWidth / scaledWidth, maxHeight / scaledHeight, 1)
  scaledWidth *= downScale
  scaledHeight *= downScale

  const upScale = Math.max(minWidth / scaledWidth, minHeight / scaledHeight, 1)
  scaledWidth *= upScale
  scaledHeight *= upScale

  return {
    mediaWidth: Math.round(Math.min(maxWidth, scaledWidth)),
    mediaHeight: Math.round(Math.min(maxHeight, scaledHeight)),
  }
}

function CanvasMediaNode({ data }: NodeProps<Node<CanvasMediaNodeData>>) {
  return (
    <>
      <div className="absolute bottom-full mb-1.5 left-0">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          {data.label}
        </span>
      </div>
      <div className="relative h-full w-full overflow-hidden rounded-2xl shadow-2xl">
        <Handle
          type="target"
          id="left"
          position={Position.Left}
          isConnectable={false}
          className="!h-3 !w-3 !border-0 !bg-transparent !opacity-0"
        />
        <Handle
          type="source"
          id="right"
          position={Position.Right}
          isConnectable={false}
          className="!h-3 !w-3 !border-0 !bg-transparent !opacity-0"
        />
        {data.mediaType === "video" ? (
          <video
            src={data.mediaSrc}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover rounded-2xl"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.mediaSrc} alt={data.label} className="h-full w-full object-cover rounded-2xl" />
        )}
      </div>
    </>
  )
}

const nodeTypes = {
  mediaNode: CanvasMediaNode,
}

const edgeTypes = {
  globeFlow: GlobeFlowEdge,
}

function CanvasHeroFlowInner() {
  const initialNodes = React.useMemo<Node<CanvasMediaNodeData>[]>(
    () =>
      canvasSeeds.map((seed) => ({
        id: seed.id,
        type: "mediaNode",
        position: seed.position,
        style: {
          width: 260,
          height: 196,
        },
        data: {
          label: seed.label,
          mediaType: seed.mediaType,
          mediaSrc: seed.mediaSrc,
        },
      })),
    []
  )
  const initialEdges = React.useMemo<Edge[]>(
    () => [
      {
        id: "flow-1",
        source: "seed-1",
        target: "seed-3",
        sourceHandle: "right",
        targetHandle: "left",
        type: "globeFlow",
      },
      {
        id: "flow-2",
        source: "seed-2",
        target: "seed-3",
        sourceHandle: "right",
        targetHandle: "left",
        type: "globeFlow",
      },
    ],
    []
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)

  React.useEffect(() => {
    setNodes(initialNodes)
  }, [initialNodes, setNodes])

  React.useEffect(() => {
    let isCancelled = false

    async function applyMediaDimensions() {
      const updates = await Promise.all(
        canvasSeeds.map(async (seed) => {
          try {
            const size = await getMediaSize(seed.mediaSrc, seed.mediaType)
            const constrained = constrainMediaSize(size.width, size.height)
            return {
              id: seed.id,
              style: {
                width: constrained.mediaWidth,
                height: constrained.mediaHeight + LABEL_HEIGHT,
              },
            }
          } catch {
            return null
          }
        })
      )

      if (isCancelled) return

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const update = updates.find((item) => item?.id === node.id)
          if (!update) return node
          return {
            ...node,
            style: update.style,
          }
        })
      )
    }

    applyMediaDimensions()

    return () => {
      isCancelled = true
    }
  }, [setNodes])

  return (
    <div className="absolute inset-0 z-10">
      <ReactFlow
        nodes={nodes}
        edges={initialEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.85}
        maxZoom={1.1}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesDraggable
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        zoomOnPinch={false}
        zoomActivationKeyCode={null}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        className="[&_.react-flow__node]:cursor-grab [&_.react-flow__node.dragging]:cursor-grabbing"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1}
          color="rgba(255,255,255,0.14)"
        />
      </ReactFlow>
    </div>
  )
}

export function CanvasHeroFlow() {
  return (
    <ReactFlowProvider>
      <CanvasHeroFlowInner />
    </ReactFlowProvider>
  )
}
