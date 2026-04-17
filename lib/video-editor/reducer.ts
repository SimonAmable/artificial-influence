import {
  cloneItemWithNewId,
  computeProjectEndFrame,
  extendCompositionToFitItems,
  findItemInProject,
  newId,
} from "./project-helpers"
import type { EditorItem, EditorProject, VideoEditorAction } from "./types"

export function deepCloneProject(p: EditorProject): EditorProject {
  return JSON.parse(JSON.stringify(p)) as EditorProject
}

export function videoEditorReducer(state: EditorProject, action: VideoEditorAction): EditorProject {
  switch (action.type) {
    case "LOAD_PROJECT": {
      const p = deepCloneProject(action.project)
      if (!p.activeTrackId || !p.tracks.some((t) => t.id === p.activeTrackId)) {
        p.activeTrackId = p.tracks[0]?.id ?? null
      }
      return p
    }

    case "SET_PROJECT_ID":
      return { ...state, id: action.id }

    case "SET_NAME":
      return { ...state, name: action.name }

    case "SET_SETTINGS": {
      const settings = { ...state.settings, ...action.settings }
      const next = { ...state, settings }
      const end = computeProjectEndFrame(next)
      if (end > settings.durationInFrames) {
        settings.durationInFrames = end
      }
      return { ...next, settings }
    }

    case "ADD_TRACK": {
      const track = {
        id: newId(),
        label: `Track ${state.tracks.length + 1}`,
        muted: false,
        hidden: false,
        items: [],
      }
      return { ...state, tracks: [...state.tracks, track], activeTrackId: track.id }
    }

    case "DELETE_TRACK": {
      const tr = state.tracks.find((t) => t.id === action.trackId)
      if (!tr || state.tracks.length <= 1) return state
      if (tr.items.length > 0) return state
      const idx = state.tracks.findIndex((t) => t.id === action.trackId)
      const nextTracks = state.tracks.filter((t) => t.id !== action.trackId)
      let activeTrackId = state.activeTrackId
      if (activeTrackId === action.trackId) {
        const fallback = nextTracks[Math.max(0, idx - 1)] ?? nextTracks[0]
        activeTrackId = fallback?.id ?? null
      }
      return {
        ...state,
        tracks: nextTracks,
        activeTrackId,
        selectedItemIds: [],
      }
    }

    case "REORDER_TRACKS": {
      const { fromIndex, toIndex } = action
      if (fromIndex === toIndex) return state
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= state.tracks.length ||
        toIndex >= state.tracks.length
      ) {
        return state
      }
      const next = [...state.tracks]
      const [row] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, row!)
      return { ...state, tracks: next }
    }

    case "SET_ACTIVE_TRACK": {
      if (action.trackId === null) {
        return { ...state, activeTrackId: null }
      }
      if (!state.tracks.some((t) => t.id === action.trackId)) return state
      return { ...state, activeTrackId: action.trackId }
    }

    case "UPDATE_TRACK":
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.trackId ? { ...t, ...action.patch } : t
        ),
      }

    case "ADD_ITEM":
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.trackId ? { ...t, items: [...t.items, action.item] } : t
        ),
        selectedItemIds: [action.item.id],
        activeTrackId: action.trackId,
      }

    case "UPDATE_ITEM": {
      const found = findItemInProject(state, action.itemId)
      if (!found) return state
      const nextItem = { ...found.item, ...action.patch } as EditorItem
      const next = {
        ...state,
        tracks: state.tracks.map((t) => ({
          ...t,
          items: t.items.map((i) => (i.id === action.itemId ? nextItem : i)),
        })),
      }
      return extendCompositionToFitItems(next)
    }

    case "REMOVE_ITEM":
      return {
        ...state,
        tracks: state.tracks.map((t) => ({
          ...t,
          items: t.items.filter((i) => i.id !== action.itemId),
        })),
        selectedItemIds: state.selectedItemIds.filter((id) => id !== action.itemId),
      }

    case "MOVE_ITEM": {
      const found = findItemInProject(state, action.itemId)
      if (!found) return state
      const { item, track } = found
      const without = state.tracks.map((t) => ({
        ...t,
        items: t.items.filter((i) => i.id !== action.itemId),
      }))
      const targetTrackId = action.trackId ?? track.id
      const moved = { ...item, from: action.from } as EditorItem
      const nextTracks = without.map((t) =>
        t.id === targetTrackId ? { ...t, items: [...t.items, moved] } : t
      )
      return extendCompositionToFitItems({ ...state, tracks: nextTracks })
    }

    case "SET_SELECTED": {
      let activeTrackId = state.activeTrackId
      if (action.ids.length === 1) {
        const found = findItemInProject(state, action.ids[0]!)
        if (found) activeTrackId = found.track.id
      }
      return { ...state, selectedItemIds: action.ids, activeTrackId }
    }

    case "TOGGLE_SELECT": {
      const set = new Set(state.selectedItemIds)
      if (action.additive) {
        if (set.has(action.itemId)) set.delete(action.itemId)
        else set.add(action.itemId)
      } else {
        set.clear()
        set.add(action.itemId)
      }
      const selectedItemIds = [...set]
      let activeTrackId = state.activeTrackId
      if (set.has(action.itemId)) {
        const found = findItemInProject(state, action.itemId)
        if (found) activeTrackId = found.track.id
      }
      return { ...state, selectedItemIds, activeTrackId }
    }

    case "SET_SNAPPING":
      return { ...state, snappingEnabled: action.enabled }

    case "SET_CANVAS_ZOOM":
      return { ...state, canvasZoom: action.zoom }

    case "SET_TIMELINE_ZOOM":
      return { ...state, timelineZoomPxPerFrame: action.pxPerFrame }

    case "SPLIT_AT_FRAME": {
      const found = findItemInProject(state, action.itemId)
      if (!found) return state
      const { item, track } = found
      const { frame } = action
      if (frame <= item.from || frame >= item.from + item.durationInFrames) {
        return state
      }
      const leftDur = frame - item.from
      const rightDur = item.from + item.durationInFrames - frame
      let left: EditorItem = {
        ...item,
        id: newId(),
        durationInFrames: leftDur,
      } as EditorItem
      let right: EditorItem = {
        ...item,
        id: newId(),
        from: frame,
        durationInFrames: rightDur,
      } as EditorItem

      if (item.type === "video" || item.type === "audio") {
        const m = item
        const consumed = Math.round(leftDur * m.playbackRate)
        left = { ...left, durationInFrames: leftDur } as typeof m
        right = {
          ...right,
          from: frame,
          durationInFrames: rightDur,
          trimStartFrames: m.trimStartFrames + consumed,
        } as typeof m
      }

      const newItems = track.items.flatMap((i) =>
        i.id === item.id ? [left, right] : [i]
      )
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === track.id ? { ...t, items: newItems } : t
        ),
        selectedItemIds: [left.id, right.id],
      }
    }

    case "DUPLICATE_ITEMS": {
      const copies: EditorItem[] = []
      let next = state
      for (const id of action.itemIds) {
        const found = findItemInProject(next, id)
        if (!found) continue
        const dup = cloneItemWithNewId(found.item, found.item.durationInFrames)
        copies.push(dup)
        next = {
          ...next,
          tracks: next.tracks.map((t) =>
            t.id === found.track.id ? { ...t, items: [...t.items, dup] } : t
          ),
        }
      }
      return {
        ...next,
        selectedItemIds: copies.map((c) => c.id),
      }
    }

    case "DELETE_SELECTED":
      return {
        ...state,
        tracks: state.tracks.map((t) => ({
          ...t,
          items: t.items.filter((i) => !state.selectedItemIds.includes(i.id)),
        })),
        selectedItemIds: [],
      }

    case "BRING_FORWARD": {
      const found = findItemInProject(state, action.itemId)
      if (!found) return state
      const { track } = found
      const idx = track.items.findIndex((i) => i.id === action.itemId)
      if (idx === -1 || idx >= track.items.length - 1) return state
      const items = [...track.items]
      const [it] = items.splice(idx, 1)
      items.push(it!)
      return {
        ...state,
        tracks: state.tracks.map((t) => (t.id === track.id ? { ...t, items } : t)),
      }
    }

    case "SEND_BACKWARD": {
      const found = findItemInProject(state, action.itemId)
      if (!found) return state
      const { track } = found
      const idx = track.items.findIndex((i) => i.id === action.itemId)
      if (idx <= 0) return state
      const items = [...track.items]
      const [it] = items.splice(idx, 1)
      items.unshift(it!)
      return {
        ...state,
        tracks: state.tracks.map((t) => (t.id === track.id ? { ...t, items } : t)),
      }
    }

    case "UNDO":
    case "REDO":
    case "PUSH_HISTORY":
      return state

    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}
