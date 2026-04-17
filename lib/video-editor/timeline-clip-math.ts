import type { EditorItem, EditorProject } from "./types"

export type SnapTimelineOptions = {
  /** Pixels per timeline frame — used to turn a pixel radius into a frame radius. */
  pxPerFrame: number
  /** When snapping is on, these frames attract the value if within range (playhead, clip edges). */
  snapFrames?: readonly number[]
  /** Magnetic radius in pixels (default 12). */
  snapRadiusPx?: number
}

/**
 * Quantizes to whole frames. When `snappingEnabled`, pulls toward the nearest
 * candidate in `snapFrames` if within a small pixel radius (magnetic snap).
 * Never snaps to whole-second grids — always frame-accurate.
 */
export function snapTimelineFrame(
  frame: number,
  snappingEnabled: boolean,
  options?: SnapTimelineOptions
): number {
  let f = Math.round(frame)
  f = Math.max(0, f)

  if (!snappingEnabled || !options?.snapFrames?.length) {
    return f
  }

  const px = options.pxPerFrame
  const radiusPx = options.snapRadiusPx ?? 12
  const radiusFrames = Math.max(1, Math.ceil(radiusPx / px))

  let best = f
  let bestDist = Infinity
  for (const snap of options.snapFrames) {
    const s = Math.max(0, Math.round(snap))
    const d = Math.abs(s - f)
    if (d <= radiusFrames && d < bestDist) {
      bestDist = d
      best = s
    }
  }

  return best
}

/** Frames that attract the magnet: playhead, composition bounds, other clips’ edges on the same track. */
export function buildMagneticSnapFrames(
  project: EditorProject,
  trackId: string,
  excludeItemId: string,
  playheadFrame: number
): number[] {
  const { durationInFrames } = project.settings
  const set = new Set<number>()
  set.add(0)
  set.add(Math.max(0, durationInFrames - 1))
  set.add(Math.max(0, Math.min(durationInFrames - 1, Math.round(playheadFrame))))

  for (const t of project.tracks) {
    if (t.id !== trackId) continue
    for (const i of t.items) {
      if (i.id === excludeItemId) continue
      set.add(i.from)
      set.add(i.from + i.durationInFrames)
    }
  }

  return [...set].sort((a, b) => a - b)
}

/** Max timeline duration (frames) that still fits source for video/audio. */
export function maxDurationForMediaItem(item: Extract<EditorItem, { type: "video" | "audio" }>): number {
  const { trimStartFrames, trimEndFrames, sourceDurationFrames, playbackRate } = item
  const usable = sourceDurationFrames - trimStartFrames - trimEndFrames
  const maxBySource = Math.max(1, Math.floor(usable / playbackRate))
  return maxBySource
}

export function applyRightEdgeTrim(
  item: EditorItem,
  newDurationFrames: number
): Partial<EditorItem> | null {
  const d = Math.max(1, Math.round(newDurationFrames))
  if (item.type === "video" || item.type === "audio") {
    const maxD = maxDurationForMediaItem(item)
    const nextDur = Math.min(d, maxD)
    const span = Math.round(nextDur * item.playbackRate)
    const trimEndFrames = Math.max(0, item.sourceDurationFrames - item.trimStartFrames - span)
    return { durationInFrames: nextDur, trimEndFrames }
  }
  return { durationInFrames: d }
}

export function applyLeftEdgeTrim(
  item: EditorItem,
  newFrom: number,
  newDuration: number
): Partial<EditorItem> | null {
  const from = Math.max(0, Math.round(newFrom))
  const dur = Math.max(1, Math.round(newDuration))
  if (item.type === "video" || item.type === "audio") {
    const deltaFrom = from - item.from
    const nextTrimStart = item.trimStartFrames + Math.round(deltaFrom * item.playbackRate)
    if (nextTrimStart < 0 || nextTrimStart >= item.sourceDurationFrames) return null
    const maxDur = Math.max(
      1,
      Math.floor((item.sourceDurationFrames - nextTrimStart) / item.playbackRate)
    )
    const nextDur = Math.min(dur, maxDur)
    const span = Math.round(nextDur * item.playbackRate)
    const trimEndFrames = Math.max(0, item.sourceDurationFrames - nextTrimStart - span)
    return {
      from,
      durationInFrames: nextDur,
      trimStartFrames: nextTrimStart,
      trimEndFrames,
    }
  }
  return { from, durationInFrames: dur }
}
