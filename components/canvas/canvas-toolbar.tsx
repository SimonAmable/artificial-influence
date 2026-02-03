"use client"

import { MagnifyingGlassPlus, MagnifyingGlassMinus, CornersOut, GridFour } from "@phosphor-icons/react"
import { useReactFlow, useViewport } from "@xyflow/react"

export function CanvasToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const { zoom } = useViewport()

  return (
    <div className="flex items-center gap-1 bg-zinc-900/90 border border-white/10 rounded-lg p-1">
      <button
        onClick={() => zoomOut()}
        className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        title="Zoom out"
      >
        <MagnifyingGlassMinus size={16} />
      </button>

      <span className="text-[11px] text-zinc-400 w-10 text-center tabular-nums select-none">
        {Math.round(zoom * 100)}%
      </span>

      <button
        onClick={() => zoomIn()}
        className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        title="Zoom in"
      >
        <MagnifyingGlassPlus size={16} />
      </button>

      <div className="w-px h-4 bg-white/10 mx-0.5" />

      <button
        onClick={() => fitView({ padding: 0.2 })}
        className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        title="Fit view"
      >
        <CornersOut size={16} />
      </button>

      <button
        className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        title="Grid snap"
      >
        <GridFour size={16} />
      </button>
    </div>
  )
}
