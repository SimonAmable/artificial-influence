"use client"

import { Player, type PlayerRef } from "@remotion/player"
import * as React from "react"
import { EditorComposition } from "@/components/video-editor/remotion/editor-composition"
import type { EditorProject } from "@/lib/video-editor/types"

type EditorPlayerProps = {
  project: EditorProject
  currentFrame: number
  isPlaying: boolean
  loop: boolean
  muted: boolean
  className?: string
  playerRef: React.RefObject<PlayerRef | null>
  onPlaybackEnded?: () => void
  onPausedAtFrame?: (frame: number) => void
}

export function EditorPlayer({
  project,
  currentFrame,
  isPlaying,
  loop,
  muted,
  className,
  playerRef,
  onPlaybackEnded,
  onPausedAtFrame,
}: EditorPlayerProps) {
  const { width, height, durationInFrames, fps } = project.settings
  const inputProps = React.useMemo(() => ({ project }), [project])
  const wasPlayingRef = React.useRef(isPlaying)

  React.useEffect(() => {
    const p = playerRef.current
    if (!p) return
    if (!isPlaying) {
      p.seekTo(currentFrame)
    }
  }, [currentFrame, isPlaying, playerRef])

  React.useEffect(() => {
    const p = playerRef.current
    if (!p) return
    if (isPlaying) p.play()
    else p.pause()
  }, [isPlaying, playerRef])

  React.useEffect(() => {
    if (wasPlayingRef.current && !isPlaying) {
      const frame = playerRef.current?.getCurrentFrame()
      if (frame !== undefined) {
        onPausedAtFrame?.(frame)
      }
    }
    wasPlayingRef.current = isPlaying
  }, [isPlaying, onPausedAtFrame, playerRef])

  React.useEffect(() => {
    const p = playerRef.current
    if (!p || !isPlaying) return

    const onFrame = (ev: { detail: { frame: number } }) => {
      const frame = ev.detail.frame
      if (!loop && frame >= durationInFrames - 1) {
        onPlaybackEnded?.()
      }
    }

    p.addEventListener("frameupdate", onFrame)
    return () => p.removeEventListener("frameupdate", onFrame)
  }, [durationInFrames, isPlaying, loop, onPlaybackEnded, playerRef])

  React.useEffect(() => {
    const p = playerRef.current
    if (!p) return
    if (muted) p.mute()
    else p.unmute()
  }, [muted, playerRef])

  return (
    <div className={className}>
      <Player
        ref={playerRef}
        component={EditorComposition}
        inputProps={inputProps}
        durationInFrames={durationInFrames}
        fps={fps}
        compositionWidth={width}
        compositionHeight={height}
        style={{ width: "100%", height: "100%" }}
        controls={false}
        loop={loop}
        numberOfSharedAudioTags={10}
        acknowledgeRemotionLicense
        renderLoading={() => (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            Loading preview…
          </div>
        )}
        initiallyMuted={muted}
        clickToPlay={false}
        doubleClickToFullscreen={false}
        spaceKeyToPlayOrPause={false}
        moveToBeginningWhenEnded={!loop}
        showVolumeControls={false}
      />
    </div>
  )
}
