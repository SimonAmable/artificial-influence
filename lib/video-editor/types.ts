import type { Caption } from "@remotion/captions"
import { z } from "zod"

/** Normalized crop 0–1 from each edge */
export type CropRect = {
  top: number
  right: number
  bottom: number
  left: number
}

export type BaseItemFields = {
  id: string
  from: number
  durationInFrames: number
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  borderRadius: number
  fadeInFrames: number
  fadeOutFrames: number
  crop: CropRect | null
  keepAspectRatio: boolean
}

export type ImageItem = BaseItemFields & {
  type: "image"
  src: string
  assetId?: string
  fileName?: string
}

export type VideoItem = BaseItemFields & {
  type: "video"
  src: string
  assetId?: string
  fileName?: string
  /** Trim from start of source media (frames) */
  trimStartFrames: number
  /** Trim from end of source, frames counted from start of source after trimStart */
  trimEndFrames: number
  /** Source duration in frames (for max trim UI) */
  sourceDurationFrames: number
  volume: number
  volumeDb: number
  playbackRate: number
}

export type AudioItem = BaseItemFields & {
  type: "audio"
  src: string
  assetId?: string
  fileName?: string
  trimStartFrames: number
  trimEndFrames: number
  sourceDurationFrames: number
  volume: number
  volumeDb: number
  playbackRate: number
}

export type GifItem = BaseItemFields & {
  type: "gif"
  src: string
  assetId?: string
  fileName?: string
}

export type TextItem = BaseItemFields & {
  type: "text"
  text: string
  fontFamily: string
  fontWeight: string
  fontStyle: "normal" | "italic"
  fontSize: number
  textAlign: "left" | "center" | "right"
  textDirection: "ltr" | "rtl"
  lineHeight: number
  letterSpacingPx: number
  color: string
  backgroundColor: string | null
  backgroundPaddingX: number
  backgroundRadius: number
}

export type SolidItem = BaseItemFields & {
  type: "solid"
  fill: string
}

export type CaptionsItem = BaseItemFields & {
  type: "captions"
  captions: Caption[]
  pageDurationMs: number
  maxLines: number
  highlightColor: string
  fontFamily: string
  fontSize: number
  textAlign: "left" | "center" | "right"
}

export type EditorItem =
  | ImageItem
  | VideoItem
  | AudioItem
  | GifItem
  | TextItem
  | SolidItem
  | CaptionsItem

export const TRACK_KINDS = ["image", "video", "text", "captions", "audio"] as const

export type TrackKind = (typeof TRACK_KINDS)[number]

export type Track = {
  id: string
  kind: TrackKind
  label: string
  muted: boolean
  hidden: boolean
  items: EditorItem[]
}

export type EditorSettings = {
  fps: number
  width: number
  height: number
  durationInFrames: number
}

export type EditorProject = {
  id: string | null
  name: string
  settings: EditorSettings
  tracks: Track[]
  /** Track that receives new clips / imports (timeline focus). */
  activeTrackId: string | null
  selectedItemIds: string[]
  snappingEnabled: boolean
  canvasZoom: number
  timelineZoomPxPerFrame: number
}

const DEFAULT_TRACK_LABELS: Record<TrackKind, string> = {
  image: "Image",
  video: "Video",
  text: "Text",
  captions: "Captions",
  audio: "Audio",
}

const DEFAULT_TRACK_IDS: Record<TrackKind, string> = {
  image: "track-image",
  video: "track-video",
  text: "track-text",
  captions: "track-captions",
  audio: "track-audio",
}

const DEFAULT_DURATION_FALLBACK_FRAMES = 30 * 10

type TrackInput = Omit<Track, "kind"> & {
  kind?: TrackKind
}

type EditorProjectInput = Omit<EditorProject, "tracks" | "activeTrackId"> & {
  tracks: TrackInput[]
  activeTrackId?: string | null
}

function isTrackKind(value: unknown): value is TrackKind {
  return typeof value === "string" && TRACK_KINDS.includes(value as TrackKind)
}

export function trackKindForItem(item: EditorItem): TrackKind {
  switch (item.type) {
    case "image":
    case "gif":
    case "solid":
      return "image"
    case "video":
      return "video"
    case "text":
      return "text"
    case "captions":
      return "captions"
    case "audio":
      return "audio"
    default: {
      const exhaustive: never = item
      return exhaustive
    }
  }
}

export function isTrackCompatibleWithItem(
  track: Pick<Track, "kind">,
  item: EditorItem
): boolean {
  return track.kind === trackKindForItem(item)
}

export function createDefaultTracks(): Track[] {
  return TRACK_KINDS.map((kind) => ({
    id: DEFAULT_TRACK_IDS[kind],
    kind,
    label: DEFAULT_TRACK_LABELS[kind],
    muted: false,
    hidden: false,
    items: [],
  }))
}

function computeDerivedDurationFromTracks(tracks: Track[]): number {
  let maxEnd = 0
  for (const track of tracks) {
    for (const item of track.items) {
      maxEnd = Math.max(maxEnd, item.from + item.durationInFrames)
    }
  }
  return Math.max(DEFAULT_DURATION_FALLBACK_FRAMES, maxEnd)
}

function resolveActiveTrackId(
  input: EditorProjectInput,
  normalizedTracks: Track[]
): string | null {
  const activeSource = input.activeTrackId
    ? input.tracks.find((track) => track.id === input.activeTrackId)
    : null

  const activeKind =
    activeSource?.items[0] ? trackKindForItem(activeSource.items[0]) : activeSource?.kind

  if (activeKind && isTrackKind(activeKind)) {
    return normalizedTracks.find((track) => track.kind === activeKind)?.id ?? null
  }

  return normalizedTracks[0]?.id ?? null
}

export function normalizeEditorProject(input: EditorProjectInput): EditorProject {
  const normalizedTracks = createDefaultTracks()
  const trackByKind = new Map(normalizedTracks.map((track) => [track.kind, track]))
  const kindStates = new Map<
    TrackKind,
    {
      muted: boolean[]
      hidden: boolean[]
    }
  >(
    TRACK_KINDS.map((kind) => [
      kind,
      {
        muted: [],
        hidden: [],
      },
    ])
  )

  for (const sourceTrack of input.tracks) {
    const contributedKinds = new Set<TrackKind>()
    if (isTrackKind(sourceTrack.kind)) {
      contributedKinds.add(sourceTrack.kind)
    }
    for (const item of sourceTrack.items) {
      const kind = trackKindForItem(item)
      contributedKinds.add(kind)
      trackByKind.get(kind)?.items.push(item)
    }
    for (const kind of contributedKinds) {
      const state = kindStates.get(kind)
      state?.muted.push(sourceTrack.muted)
      state?.hidden.push(sourceTrack.hidden)
    }
  }

  for (const track of normalizedTracks) {
    const state = kindStates.get(track.kind)
    if (!state || state.muted.length === 0) {
      continue
    }
    track.muted = state.muted.every(Boolean)
    track.hidden = state.hidden.every(Boolean)
  }

  return {
    ...input,
    settings: {
      ...input.settings,
      durationInFrames: computeDerivedDurationFromTracks(normalizedTracks),
    },
    tracks: normalizedTracks,
    activeTrackId: resolveActiveTrackId(input, normalizedTracks),
  }
}

const cropSchema = z.object({
  top: z.number(),
  right: z.number(),
  bottom: z.number(),
  left: z.number(),
})

const baseFields = {
  id: z.string(),
  from: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number(),
  opacity: z.number().min(0).max(1),
  borderRadius: z.number().nonnegative(),
  fadeInFrames: z.number().int().nonnegative(),
  fadeOutFrames: z.number().int().nonnegative(),
  crop: cropSchema.nullable(),
  keepAspectRatio: z.boolean(),
}

export const editorItemSchema: z.ZodType<EditorItem> = z.discriminatedUnion("type", [
  z.object({ ...baseFields, type: z.literal("image"), src: z.string(), assetId: z.string().optional(), fileName: z.string().optional() }),
  z.object({
    ...baseFields,
    type: z.literal("video"),
    src: z.string(),
    assetId: z.string().optional(),
    fileName: z.string().optional(),
    trimStartFrames: z.number().int().nonnegative(),
    trimEndFrames: z.number().int().nonnegative(),
    sourceDurationFrames: z.number().int().positive(),
    volume: z.number().min(0).max(1),
    volumeDb: z.number(),
    playbackRate: z.number().positive(),
  }),
  z.object({
    ...baseFields,
    type: z.literal("audio"),
    src: z.string(),
    assetId: z.string().optional(),
    fileName: z.string().optional(),
    trimStartFrames: z.number().int().nonnegative(),
    trimEndFrames: z.number().int().nonnegative(),
    sourceDurationFrames: z.number().int().positive(),
    volume: z.number().min(0).max(1),
    volumeDb: z.number(),
    playbackRate: z.number().positive(),
  }),
  z.object({ ...baseFields, type: z.literal("gif"), src: z.string(), assetId: z.string().optional(), fileName: z.string().optional() }),
  z.object({
    ...baseFields,
    type: z.literal("text"),
    text: z.string(),
    fontFamily: z.string(),
    fontWeight: z.string(),
    fontStyle: z.enum(["normal", "italic"]),
    fontSize: z.number().positive(),
    textAlign: z.enum(["left", "center", "right"]),
    textDirection: z.enum(["ltr", "rtl"]),
    lineHeight: z.number().min(0.5).max(5),
    letterSpacingPx: z.number().min(-10).max(50),
    color: z.string(),
    backgroundColor: z.string().nullable(),
    backgroundPaddingX: z.number().nonnegative(),
    backgroundRadius: z.number().nonnegative(),
  }),
  z.object({ ...baseFields, type: z.literal("solid"), fill: z.string() }),
  z.object({
    ...baseFields,
    type: z.literal("captions"),
    captions: z.array(
      z.object({
        text: z.string(),
        startMs: z.number(),
        endMs: z.number(),
        timestampMs: z.number().nullable(),
        confidence: z.number().nullable(),
      })
    ),
    pageDurationMs: z.number().positive(),
    maxLines: z.number().int().positive(),
    highlightColor: z.string(),
    fontFamily: z.string(),
    fontSize: z.number().positive(),
    textAlign: z.enum(["left", "center", "right"]),
  }),
])

const editorProjectInputSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  settings: z.object({
    fps: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    durationInFrames: z.number().int().positive(),
  }),
  tracks: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(TRACK_KINDS).optional(),
      label: z.string(),
      muted: z.boolean(),
      hidden: z.boolean(),
      items: z.array(editorItemSchema),
    })
  ),
  activeTrackId: z.string().nullable().optional(),
  selectedItemIds: z.array(z.string()),
  snappingEnabled: z.boolean(),
  canvasZoom: z.number().positive(),
  timelineZoomPxPerFrame: z.number().positive(),
})

export const editorProjectSchema = editorProjectInputSchema.transform((data) =>
  normalizeEditorProject(data)
)

export type VideoEditorAction =
  | { type: "LOAD_PROJECT"; project: EditorProject }
  | { type: "SET_PROJECT_ID"; id: string | null }
  | { type: "SET_NAME"; name: string }
  | { type: "SET_SETTINGS"; settings: Partial<EditorSettings> }
  | { type: "ADD_TRACK" }
  | { type: "DELETE_TRACK"; trackId: string }
  | { type: "REORDER_TRACKS"; fromIndex: number; toIndex: number }
  | { type: "SET_ACTIVE_TRACK"; trackId: string | null }
  | { type: "UPDATE_TRACK"; trackId: string; patch: Partial<Pick<Track, "label" | "muted" | "hidden">> }
  | { type: "ADD_ITEM"; trackId: string; item: EditorItem }
  | { type: "UPDATE_ITEM"; itemId: string; patch: Partial<EditorItem> }
  | { type: "REMOVE_ITEM"; itemId: string }
  | { type: "MOVE_ITEM"; itemId: string; from: number; trackId?: string }
  | { type: "SET_SELECTED"; ids: string[] }
  | { type: "TOGGLE_SELECT"; itemId: string; additive: boolean }
  | { type: "SET_SNAPPING"; enabled: boolean }
  | { type: "SET_CANVAS_ZOOM"; zoom: number }
  | { type: "SET_TIMELINE_ZOOM"; pxPerFrame: number }
  | { type: "SPLIT_AT_FRAME"; itemId: string; frame: number }
  | { type: "DUPLICATE_ITEMS"; itemIds: string[] }
  | { type: "DELETE_SELECTED" }
  | { type: "BRING_FORWARD"; itemId: string }
  | { type: "SEND_BACKWARD"; itemId: string }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "PUSH_HISTORY" }
