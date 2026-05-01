import {
  DEFAULT_DURATION_FRAMES,
  DEFAULT_FPS,
  DEFAULT_HEIGHT,
  DEFAULT_IMAGE_DURATION_FRAMES,
  DEFAULT_SOLID_DURATION_FRAMES,
  DEFAULT_TEXT_DURATION_FRAMES,
  DEFAULT_WIDTH,
} from "./constants"
import {
  createDefaultTracks,
  normalizeEditorProject,
  type EditorItem,
  type EditorProject,
  type Track,
  type VideoItem,
} from "./types"

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createEmptyProject(): EditorProject {
  return normalizeEditorProject({
    id: null,
    name: "Untitled Project",
    settings: {
      fps: DEFAULT_FPS,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      durationInFrames: DEFAULT_DURATION_FRAMES,
    },
    tracks: createDefaultTracks(),
    activeTrackId: null,
    selectedItemIds: [],
    snappingEnabled: true,
    canvasZoom: 1,
    timelineZoomPxPerFrame: 2,
  })
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
  return Math.max(max, DEFAULT_DURATION_FRAMES)
}

/** Keeps project duration derived from its clips, with an empty-project fallback. */
export function syncCompositionToItems(project: EditorProject): EditorProject {
  const nextDuration = computeProjectEndFrame(project)
  if (nextDuration === project.settings.durationInFrames) {
    return project
  }
  return {
    ...project,
    settings: {
      ...project.settings,
      durationInFrames: nextDuration,
    },
  }
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
