"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2, Volume2, VolumeX } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useVideoEditor } from "@/components/video-editor/video-editor-provider"
import { TimelineClip } from "@/components/video-editor/timeline/timeline-clip"
import { cn } from "@/lib/utils"

const GUTTER_PX = 120
const RULER_H = 32
const TRACK_ROW_H = 36

export function TimelinePanel({ className }: { className?: string }) {
  const {
    project,
    dispatch,
    currentFrame,
    setCurrentFrame,
    isPlaying,
    setIsPlaying,
  } = useVideoEditor()
  const { fps, durationInFrames } = project.settings
  const px = project.timelineZoomPxPerFrame
  const totalWidth = durationInFrames * px
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const onRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return
    const el = scrollRef.current
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left + el.scrollLeft
    const frame = Math.max(0, Math.min(durationInFrames - 1, Math.round(x / px)))
    setCurrentFrame(frame)
    setIsPlaying(false)

    const move = (ev: PointerEvent) => {
      const xx = ev.clientX - rect.left + el.scrollLeft
      const f = Math.max(0, Math.min(durationInFrames - 1, Math.round(xx / px)))
      setCurrentFrame(f)
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const trackCount = project.tracks.length
  const contentHeight = RULER_H + trackCount * TRACK_ROW_H
  const activeTrackId = project.activeTrackId ?? project.tracks[0]?.id

  return (
    <div className={cn("flex min-h-0 flex-col border-t border-border bg-muted/15", className)}>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-2 py-1">
        <span className="text-[10px] text-muted-foreground">Timeline</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-[10px]"
          onClick={() => dispatch({ type: "ADD_TRACK" })}
        >
          <Plus className="size-3.5" />
          Add track
        </Button>
        <span className="text-[10px] text-muted-foreground">Zoom</span>
        <input
          type="range"
          min={0.5}
          max={8}
          step={0.25}
          value={px}
          onChange={(e) =>
            dispatch({ type: "SET_TIMELINE_ZOOM", pxPerFrame: Number(e.target.value) })
          }
          className="h-1.5 w-28 accent-primary"
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1">
        {/* Track names + controls — time grid starts in the scroll area so it lines up with clips */}
        <div
          className="flex w-[120px] shrink-0 flex-col border-r border-border bg-muted/25"
          style={{ minWidth: GUTTER_PX }}
        >
          <div
            className="flex shrink-0 items-end border-b border-border px-2 pb-1 text-[10px] text-muted-foreground"
            style={{ height: RULER_H }}
          >
            Tracks
          </div>
          {project.tracks.map((track, trackIndex) => {
            const isActive = track.id === activeTrackId
            return (
              <div
                key={track.id}
                data-timeline-track={track.id}
                className={cn(
                  "flex shrink-0 items-center gap-0.5 border-b border-border/60 px-1",
                  isActive && "border-l-2 border-l-primary bg-primary/10"
                )}
                style={{ height: TRACK_ROW_H }}
              >
                <div className="flex shrink-0 flex-col gap-px">
                  <button
                    type="button"
                    title="Move track up"
                    disabled={trackIndex === 0}
                    className="rounded p-0 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch({ type: "REORDER_TRACKS", fromIndex: trackIndex, toIndex: trackIndex - 1 })
                    }}
                  >
                    <ChevronUp className="size-3" />
                  </button>
                  <button
                    type="button"
                    title="Move track down"
                    disabled={trackIndex >= project.tracks.length - 1}
                    className="rounded p-0 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch({ type: "REORDER_TRACKS", fromIndex: trackIndex, toIndex: trackIndex + 1 })
                    }}
                  >
                    <ChevronDown className="size-3" />
                  </button>
                </div>
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-[11px] font-medium leading-tight hover:underline"
                  title="Click to make this the active track for new clips"
                  onClick={() => dispatch({ type: "SET_ACTIVE_TRACK", trackId: track.id })}
                >
                  {track.label}
                </button>
                <button
                  type="button"
                  title={
                    track.items.length > 0
                      ? "Remove clips before deleting track"
                      : project.tracks.length <= 1
                        ? "Cannot delete the only track"
                        : "Delete empty track"
                  }
                  disabled={project.tracks.length <= 1 || track.items.length > 0}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:opacity-30"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (track.items.length > 0) {
                      toast.error("Remove or move clips before deleting this track")
                      return
                    }
                    if (project.tracks.length <= 1) return
                    dispatch({ type: "DELETE_TRACK", trackId: track.id })
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
                <button
                  type="button"
                  title={track.hidden ? "Show track" : "Hide track"}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    dispatch({ type: "UPDATE_TRACK", trackId: track.id, patch: { hidden: !track.hidden } })
                  }}
                >
                  {track.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
                <button
                  type="button"
                  title={track.muted ? "Unmute track" : "Mute track"}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    dispatch({ type: "UPDATE_TRACK", trackId: track.id, patch: { muted: !track.muted } })
                  }}
                >
                  {track.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                </button>
              </div>
            )
          })}
        </div>

        <div
          ref={scrollRef}
          className="relative min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden scroll-smooth"
        >
          <div className="relative select-none" style={{ width: totalWidth, minHeight: contentHeight }}>
            {/* Vertical grid — aligned with time (same origin as ruler + clips) */}
            <div
              className="pointer-events-none absolute inset-0 z-0"
              aria-hidden
            >
              {Array.from({ length: Math.ceil(durationInFrames / fps) + 2 }).map((_, i) => {
                const f = i * fps
                if (f > durationInFrames + fps) return null
                return (
                  <div
                    key={`g-${f}`}
                    className="absolute top-0 bottom-0 border-l border-border/40"
                    style={{ left: f * px }}
                  />
                )
              })}
            </div>

            {/* Playhead — spans ruler + tracks */}
            <div
              className="pointer-events-none absolute top-0 z-30 w-px bg-primary shadow-[0_0_6px_hsl(var(--primary))]"
              style={{
                left: currentFrame * px,
                height: contentHeight,
              }}
            />
            {/* Ruler — same width & origin as track rows */}
            <div
              className="sticky top-0 z-20 flex h-8 cursor-pointer items-end border-b border-border bg-background/95 backdrop-blur-sm"
              style={{ width: totalWidth }}
              onPointerDown={onRulerPointerDown}
            >
              {Array.from({ length: Math.ceil(durationInFrames / fps) + 1 }).map((_, i) => {
                const f = i * fps
                if (f > durationInFrames) return null
                return (
                  <div
                    key={f}
                    className="absolute bottom-0 flex flex-col justify-end border-l border-primary/25 pl-1"
                    style={{ left: f * px, height: "100%" }}
                  >
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {i}s
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Track rows */}
            {project.tracks.map((track) => (
              <div
                key={track.id}
                data-timeline-track={track.id}
                className={cn(
                  "relative border-b border-border/50 bg-muted/10",
                  track.hidden && "opacity-40",
                  track.id === activeTrackId && "bg-primary/[0.07]"
                )}
                style={{ width: totalWidth, height: TRACK_ROW_H }}
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) {
                    dispatch({ type: "SET_SELECTED", ids: [] })
                    dispatch({ type: "SET_ACTIVE_TRACK", trackId: track.id })
                  }
                }}
              >
                {track.items.map((item) => (
                  <TimelineClip
                    key={item.id}
                    item={item}
                    trackId={track.id}
                    project={project}
                    px={px}
                    currentFrame={currentFrame}
                    scrollRef={scrollRef}
                    dispatch={dispatch}
                    setIsPlaying={setIsPlaying}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-2 py-1 text-[10px] text-muted-foreground">
        Frame {currentFrame} / {durationInFrames - 1} · {isPlaying ? "Playing" : "Paused"} · active:{" "}
        {project.tracks.find((t) => t.id === activeTrackId)?.label ?? "—"} · drag clips between tracks · trim
        edges
      </div>
    </div>
  )
}
