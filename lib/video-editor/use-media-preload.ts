"use client"

import { useEffect } from "react"
import { preloadAudio, preloadVideo } from "@remotion/preload"
import type { EditorProject } from "@/lib/video-editor/types"

/** Preload media URLs near the playhead to reduce Player buffering. */
export function useMediaPreload(project: EditorProject, playheadFrame: number) {
  const { fps } = project.settings
  const windowFrames = fps * 5

  useEffect(() => {
    const cleanups: (() => void)[] = []
    const seen = new Set<string>()

    for (const track of project.tracks) {
      if (track.hidden) continue
      for (const item of track.items) {
        if (item.type !== "video" && item.type !== "audio") continue
        if (seen.has(item.src)) continue

        const clipStart = item.from
        const clipEnd = item.from + item.durationInFrames
        const windowStart = playheadFrame
        const windowEnd = playheadFrame + windowFrames

        if (clipEnd < windowStart || clipStart > windowEnd) continue

        seen.add(item.src)
        const cleanup =
          item.type === "video" ? preloadVideo(item.src) : preloadAudio(item.src)
        cleanups.push(cleanup)
      }
    }

    return () => {
      for (const cleanup of cleanups) {
        cleanup()
      }
    }
  }, [project, playheadFrame, windowFrames])
}
