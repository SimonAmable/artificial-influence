"use client"

import { Player, type PlayerRef } from "@remotion/player"
import * as React from "react"
import { EditorComposition } from "@/components/video-editor/remotion/editor-composition"
import type { EditorProject } from "@/lib/video-editor/types"

type EditorPlayerProps = {
  project: EditorProject
  currentFrame: number
  onFrameUpdate?: (frame: number) => void
  isPlaying: boolean
  loop: boolean
  muted: boolean
  className?: string
  playerRef: React.RefObject<PlayerRef | null>
}

export function EditorPlayer({
  project,
  currentFrame,
  onFrameUpdate,
  isPlaying,
  loop,
  muted,
  className,
  playerRef,
}: EditorPlayerProps) {
  const { fps, width, height, durationInFrames } = project.settings

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
    const p = playerRef.current
    if (!p || !onFrameUpdate) return
    const cb = (ev: { detail: { frame: number } }) => {
      onFrameUpdate(ev.detail.frame)
    }
    p.addEventListener("frameupdate", cb)
    return () => p.removeEventListener("frameupdate", cb)
  }, [onFrameUpdate, playerRef])

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
        inputProps={{ project }}
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
