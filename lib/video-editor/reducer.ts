import {
  cloneItemWithNewId,
  findItemInProject,
  newId,
  syncCompositionToItems,
} from "./project-helpers"
import {
  isTrackCompatibleWithItem,
  normalizeEditorProject,
  type EditorItem,
  type EditorProject,
  type VideoEditorAction,
} from "./types"

export function deepCloneProject(p: EditorProject): EditorProject {
  return JSON.parse(JSON.stringify(p)) as EditorProject
}

export function videoEditorReducer(state: EditorProject, action: VideoEditorAction): EditorProject {
  switch (action.type) {
    case "LOAD_PROJECT": {
      return deepCloneProject(normalizeEditorProject(action.project))
    }

    case "SET_PROJECT_ID":
      return { ...state, id: action.id }

    case "SET_NAME":
      return { ...state, name: action.name }

    case "SET_SETTINGS": {
      const settings = { ...state.settings, ...action.settings }
      return syncCompositionToItems({ ...state, settings })
    }

    case "ADD_TRACK":
      return state

    case "DELETE_TRACK":
      return state

    case "REORDER_TRACKS":
      return state

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
      {
        const targetTrackId =
          state.tracks.find(
            (track) =>
              track.id === action.trackId && isTrackCompatibleWithItem(track, action.item)
          )?.id ??
          state.tracks.find((track) => isTrackCompatibleWithItem(track, action.item))?.id ??
          null
        if (!targetTrackId) {
          return state
        }
        return syncCompositionToItems({
          ...state,
          tracks: state.tracks.map((t) =>
            t.id === targetTrackId ? { ...t, items: [...t.items, action.item] } : t
          ),
          selectedItemIds: [action.item.id],
          activeTrackId: targetTrackId,
        })
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
      return syncCompositionToItems(next)
    }

    case "REMOVE_ITEM":
      return syncCompositionToItems({
        ...state,
        tracks: state.tracks.map((t) => ({
          ...t,
          items: t.items.filter((i) => i.id !== action.itemId),
        })),
        selectedItemIds: state.selectedItemIds.filter((id) => id !== action.itemId),
      })

    case "MOVE_ITEM": {
      const found = findItemInProject(state, action.itemId)
      if (!found) return state
      const { item, track } = found
      const without = state.tracks.map((t) => ({
        ...t,
        items: t.items.filter((i) => i.id !== action.itemId),
      }))
      const requestedTrackId = action.trackId ?? track.id
      const requestedTrack = state.tracks.find((t) => t.id === requestedTrackId)
      const targetTrackId =
        requestedTrack && isTrackCompatibleWithItem(requestedTrack, item)
          ? requestedTrack.id
          : track.id
      const moved = { ...item, from: action.from } as EditorItem
      const nextTracks = without.map((t) =>
        t.id === targetTrackId ? { ...t, items: [...t.items, moved] } : t
      )
      return syncCompositionToItems({
        ...state,
        tracks: nextTracks,
        activeTrackId: targetTrackId,
      })
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
      return syncCompositionToItems({
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === track.id ? { ...t, items: newItems } : t
        ),
        selectedItemIds: [left.id, right.id],
      })
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
      return syncCompositionToItems({
        ...next,
        selectedItemIds: copies.map((c) => c.id),
      })
    }

    case "DELETE_SELECTED":
      return syncCompositionToItems({
        ...state,
        tracks: state.tracks.map((t) => ({
          ...t,
          items: t.items.filter((i) => !state.selectedItemIds.includes(i.id)),
        })),
        selectedItemIds: [],
      })

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
