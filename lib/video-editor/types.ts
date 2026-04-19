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

export type Track = {
  id: string
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

export const editorProjectSchema = z
  .object({
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
  .transform((data) => ({
    ...data,
    activeTrackId: data.activeTrackId ?? data.tracks[0]?.id ?? null,
  }))

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
