import {
  DEFAULT_DURATION_FRAMES,
  DEFAULT_FPS,
  DEFAULT_HEIGHT,
  DEFAULT_IMAGE_DURATION_FRAMES,
  DEFAULT_SOLID_DURATION_FRAMES,
  DEFAULT_TEXT_DURATION_FRAMES,
  DEFAULT_WIDTH,
} from "./constants"
import type { EditorItem, EditorProject, Track, VideoItem } from "./types"

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createEmptyProject(): EditorProject {
  const firstTrackId = newId()
  const secondTrackId = newId()
  return {
    id: null,
    name: "Untitled Project",
    settings: {
      fps: DEFAULT_FPS,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      durationInFrames: DEFAULT_DURATION_FRAMES,
    },
    tracks: [
      {
        id: firstTrackId,
        label: "Track 1",
        muted: false,
        hidden: false,
        items: [],
      },
      {
        id: secondTrackId,
        label: "Track 2",
        muted: false,
        hidden: false,
        items: [],
      },
    ],
    activeTrackId: firstTrackId,
    selectedItemIds: [],
    snappingEnabled: true,
    canvasZoom: 1,
    timelineZoomPxPerFrame: 2,
  }
}

export function findItemInProject(project: EditorProject, itemId: string): { track: Track; item: EditorItem; trackIndex: number; itemIndex: number } | null {
  for (let ti = 0; ti < project.tracks.length; ti++) {
    const track = project.tracks[ti]
    const ii = track.items.findIndex((i) => i.id === itemId)
    if (ii !== -1) {
      return { track, item: track.items[ii]!, trackIndex: ti, itemIndex: ii }
    }
  }
  return null
}

export function computeEndFrame(item: EditorItem): number {
  return item.from + item.durationInFrames
}

export function computeProjectEndFrame(project: EditorProject): number {
  let max = 0
  for (const track of project.tracks) {
    for (const item of track.items) {
      const end = computeEndFrame(item)
      if (end > max) max = end
    }
  }
  return Math.max(max, project.settings.durationInFrames)
}

/** Extends composition duration when clips extend past the current end. */
export function extendCompositionToFitItems(project: EditorProject): EditorProject {
  let maxEnd = 0
  for (const track of project.tracks) {
    for (const item of track.items) {
      maxEnd = Math.max(maxEnd, computeEndFrame(item))
    }
  }
  if (maxEnd > project.settings.durationInFrames) {
    return { ...project, settings: { ...project.settings, durationInFrames: maxEnd } }
  }
  return project
}

export function defaultDurationForType(type: EditorItem["type"], fps: number): number {
  switch (type) {
    case "image":
    case "gif":
      return DEFAULT_IMAGE_DURATION_FRAMES
    case "text":
      return DEFAULT_TEXT_DURATION_FRAMES
    case "solid":
      return DEFAULT_SOLID_DURATION_FRAMES
    case "captions":
      return fps * 5
    case "video":
    case "audio":
      return fps * 5
    default: {
      const _exhaustive: never = type
      return _exhaustive
    }
  }
}

export function cloneItemWithNewId(item: EditorItem, offsetFrames: number): EditorItem {
  const base = { ...item, id: newId(), from: item.from + offsetFrames }
  return base as EditorItem
}

/** Source trim range for @remotion/media Video */
export function videoTrimForRemotion(item: VideoItem): { trimBefore: number; trimAfter: number } {
  const trimBefore = item.trimStartFrames
  const span = Math.round(item.durationInFrames * item.playbackRate)
  const end = Math.min(
    item.sourceDurationFrames - item.trimEndFrames,
    trimBefore + span
  )
  return { trimBefore, trimAfter: Math.max(trimBefore + 1, end) }
}
