import type {
  CompositionSettings,
  CreateEditorProjectInput,
  EditorAspectRatioPreset,
  TextStyleConfig,
  TimelineItemPlacement,
  TimelineState,
  TimelineTrack,
  TransitionConfig,
} from "@/lib/editor/types"

export const DEFAULT_TRANSITION: TransitionConfig = {
  type: "cut",
  durationInFrames: 0,
}

export const DEFAULT_PLACEMENT: TimelineItemPlacement = {
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
  rotation: 0,
  opacity: 1,
  objectFit: "cover",
}

export const DEFAULT_TEXT_STYLE: TextStyleConfig = {
  fontFamily: "Georgia, serif",
  fontSize: 84,
  fontWeight: 700,
  lineHeight: 1.1,
  color: "#ffffff",
  textAlign: "center",
  backgroundColor: "transparent",
}

export function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function getCompositionSettings(
  preset: EditorAspectRatioPreset = "landscape",
): CompositionSettings {
  if (preset === "portrait") {
    return {
      width: 1080,
      height: 1920,
      fps: 30,
      durationInFrames: 300,
      backgroundColor: "#09090b",
      aspectRatioPreset: preset,
    }
  }

  if (preset === "square") {
    return {
      width: 1080,
      height: 1080,
      fps: 30,
      durationInFrames: 300,
      backgroundColor: "#09090b",
      aspectRatioPreset: preset,
    }
  }

  return {
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 300,
    backgroundColor: "#09090b",
    aspectRatioPreset: preset,
  }
}

export function createDefaultTracks(): TimelineTrack[] {
  return [
    { id: "overlay-track", name: "Overlay", type: "overlay", items: [] },
    { id: "video-track", name: "Video", type: "video", items: [] },
    { id: "audio-track", name: "Audio", type: "audio", items: [] },
  ]
}

export function createEmptyTimelineState(): TimelineState {
  return {
    tracks: createDefaultTracks(),
  }
}

export function createDefaultProjectInput(
  name = "Untitled Project",
): CreateEditorProjectInput {
  return {
    name,
    description: null,
    thumbnail_url: null,
    composition_settings: getCompositionSettings("landscape"),
    timeline_state: createEmptyTimelineState(),
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function roundFrame(value: number): number {
  return Math.max(0, Math.round(value))
}

export function formatFramesToDuration(
  durationInFrames: number,
  fps: number,
): string {
  const totalSeconds = Math.max(0, Math.round(durationInFrames / fps))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export function recalculateCompositionDuration(
  timelineState: TimelineState,
  minimumDurationInFrames: number,
): number {
  const lastItemFrame = timelineState.tracks
    .flatMap((track) => track.items)
    .reduce((max, item) => {
      return Math.max(max, item.startFrame + item.durationInFrames)
    }, 0)

  return Math.max(minimumDurationInFrames, lastItemFrame + 30)
}
