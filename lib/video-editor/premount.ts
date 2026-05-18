import type { EditorItem } from "@/lib/video-editor/types"

/** Premount window for media clips (frames). @see https://www.remotion.dev/docs/player/premounting */
export function premountFramesForItem(item: EditorItem, fps: number): number {
  switch (item.type) {
    case "video":
    case "audio":
    case "gif":
      return Math.min(15, Math.max(1, Math.round(fps / 2)))
    default:
      return 0
  }
}
