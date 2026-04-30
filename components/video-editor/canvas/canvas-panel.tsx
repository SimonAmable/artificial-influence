"use client"

import type { PlayerRef } from "@remotion/player"
import * as React from "react"
import { CanvasOverlay } from "@/components/video-editor/canvas/canvas-overlay"
import { EditorPlayer } from "@/components/video-editor/editor-player"
import { useVideoEditor } from "@/components/video-editor/video-editor-provider"
import { cn } from "@/lib/utils"

export function CanvasPanel({ className }: { className?: string }) {
  const {
    project,
    dispatch,
    currentFrame,
    setCurrentFrame,
    isPlaying,
    setIsPlaying,
    loopPlayback,
    playerMuted,
  } = useVideoEditor()
  const playerRef = React.useRef<PlayerRef>(null)
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const zoom = project.canvasZoom
  const { width: compW, height: compH } = project.settings

  const onFrameUpdate = React.useCallback(
    (frame: number) => {
      if (isPlaying) {
        setCurrentFrame(frame)
        if (frame >= project.settings.durationInFrames - 1 && !loopPlayback) {
          setIsPlaying(false)
        }
      }
    },
    [isPlaying, setCurrentFrame, project.settings.durationInFrames, loopPlayback, setIsPlaying]
  )

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col bg-background", className)}>
      <div className="flex items-center justify-between border-b border-border px-2 py-1">
        <span className="text-[10px] text-muted-foreground">Canvas {Math.round(zoom * 100)}%</span>
        <div className="flex gap-1">
          <button
            type="button"
            className="rounded border border-border px-2 py-0.5 text-[10px]"
            onClick={() => dispatch({ type: "SET_CANVAS_ZOOM", zoom: Math.min(4, zoom + 0.1) })}
          >
            +
          </button>
          <button
            type="button"
            className="rounded border border-border px-2 py-0.5 text-[10px]"
            onClick={() => dispatch({ type: "SET_CANVAS_ZOOM", zoom: Math.max(0.25, zoom - 0.1) })}
          >
            −
          </button>
          <button
            type="button"
            className="rounded border border-border px-2 py-0.5 text-[10px]"
            onClick={() => dispatch({ type: "SET_CANVAS_ZOOM", zoom: 1 })}
          >
            Fit
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pb-4 pt-6">
        <div
          ref={viewportRef}
          className="relative"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
            width: compW,
            height: compH,
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        >
          <div className="pointer-events-none absolute inset-0 z-0">
            <EditorPlayer
              project={project}
              currentFrame={currentFrame}
              onFrameUpdate={onFrameUpdate}
              isPlaying={isPlaying}
              loop={loopPlayback}
              muted={playerMuted}
              playerRef={playerRef}
              className="h-full w-full"
            />
          </div>
          <CanvasOverlay compositionRef={viewportRef} compW={compW} compH={compH} />
        </div>
      </div>
    </div>
  )
}
