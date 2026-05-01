import type { EditorItem, EditorProject, VideoItem } from "./project-types"

const DEFAULT_DURATION_FRAMES = 30 * 10

export function computeEndFrame(item: EditorItem): number {
  return item.from + item.durationInFrames
}

export function computeProjectEndFrame(project: EditorProject): number {
  let maxEnd = 0

  for (const track of project.tracks) {
    for (const item of track.items) {
      maxEnd = Math.max(maxEnd, computeEndFrame(item))
    }
  }

  return Math.max(maxEnd, DEFAULT_DURATION_FRAMES)
}

export function videoTrimForRemotion(item: VideoItem): {
  trimBefore: number
  trimAfter: number
} {
  const trimBefore = item.trimStartFrames
  const span = Math.round(item.durationInFrames * item.playbackRate)
  const end = Math.min(
    item.sourceDurationFrames - item.trimEndFrames,
    trimBefore + span
  )

  return {
    trimBefore,
    trimAfter: Math.max(trimBefore + 1, end),
  }
}
