"use client"

import * as React from "react"
import { CanvasOverlay } from "@/components/video-editor/canvas/canvas-overlay"
import { EditorPlayer } from "@/components/video-editor/editor-player"
import { useVideoEditor } from "@/components/video-editor/video-editor-provider"
import { useMediaPreload } from "@/lib/video-editor/use-media-preload"
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
    playerRef,
  } = useVideoEditor()
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const zoom = project.canvasZoom
  const { width: compW, height: compH } = project.settings

  useMediaPreload(project, currentFrame)

  const onPlaybackEnded = React.useCallback(() => {
    setIsPlaying(false)
    setCurrentFrame(Math.max(0, project.settings.durationInFrames - 1))
  }, [project.settings.durationInFrames, setCurrentFrame, setIsPlaying])

  const onPausedAtFrame = React.useCallback(
    (frame: number) => {
      setCurrentFrame(frame)
    },
    [setCurrentFrame]
  )

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col bg-background", className)}>
      <div className="flex items-center justify-between border-b border-border px-2 py-1">
        <span className="text-[10px] text-muted-foreground">
          Canvas {compW}x{compH} | {Math.round(zoom * 100)}%
        </span>
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
          className="relative overflow-hidden rounded-[24px] border border-white/15 bg-black shadow-[0_18px_40px_rgba(0,0,0,0.32)]"
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
              isPlaying={isPlaying}
              loop={loopPlayback}
              muted={playerMuted}
              playerRef={playerRef}
              onPlaybackEnded={onPlaybackEnded}
              onPausedAtFrame={onPausedAtFrame}
              className="h-full w-full"
            />
          </div>
          <div className="pointer-events-none absolute inset-0 z-10 rounded-[24px] border border-white/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" />
          <CanvasOverlay compositionRef={viewportRef} compW={compW} compH={compH} />
        </div>
      </div>
    </div>
  )
}
