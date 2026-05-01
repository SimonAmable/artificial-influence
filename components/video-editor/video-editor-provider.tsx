"use client"

import * as React from "react"
import { MAX_HISTORY } from "@/lib/video-editor/constants"
import { createEmptyProject } from "@/lib/video-editor/project-helpers"
import { deepCloneProject, videoEditorReducer } from "@/lib/video-editor/reducer"
import type { EditorProject, VideoEditorAction } from "@/lib/video-editor/types"

const NO_HISTORY: Set<VideoEditorAction["type"]> = new Set([
  "LOAD_PROJECT",
  "SET_PROJECT_ID",
  "SET_SELECTED",
  "TOGGLE_SELECT",
  "SET_ACTIVE_TRACK",
  "SET_SNAPPING",
  "SET_CANVAS_ZOOM",
  "SET_TIMELINE_ZOOM",
])

type EditorHistoryState = {
  project: EditorProject
  past: EditorProject[]
  future: EditorProject[]
}

function editorHistoryReducer(
  state: EditorHistoryState,
  action: VideoEditorAction
): EditorHistoryState {
  if (action.type === "UNDO") {
    if (state.past.length === 0) return state
    const prev = state.past[state.past.length - 1]!
    return {
      project: prev,
      past: state.past.slice(0, -1),
      future: [deepCloneProject(state.project), ...state.future],
    }
  }
  if (action.type === "REDO") {
    if (state.future.length === 0) return state
    const [next, ...rest] = state.future
    return {
      project: next!,
      past: [...state.past, deepCloneProject(state.project)],
      future: rest,
    }
  }
  if (action.type === "LOAD_PROJECT") {
    return {
      project: videoEditorReducer(state.project, action),
      past: [],
      future: [],
    }
  }

  if (action.type === "SET_PROJECT_ID") {
    return {
      ...state,
      project: videoEditorReducer(state.project, action),
    }
  }

  const nextProject = videoEditorReducer(state.project, action)
  if (!NO_HISTORY.has(action.type)) {
    return {
      project: nextProject,
      past: [...state.past, deepCloneProject(state.project)].slice(-MAX_HISTORY),
      future: [],
    }
  }
  return { ...state, project: nextProject }
}

const initialEditorState: EditorHistoryState = {
  project: createEmptyProject(),
  past: [],
  future: [],
}

export type VideoEditorContextValue = {
  project: EditorProject
  dispatch: (action: VideoEditorAction) => void
  hydrateProject: (project: EditorProject) => void
  currentFrame: number
  setCurrentFrame: React.Dispatch<React.SetStateAction<number>>
  isPlaying: boolean
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>
  loopPlayback: boolean
  setLoopPlayback: (v: boolean) => void
  playerMuted: boolean
  setPlayerMuted: (v: boolean) => void
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

const VideoEditorContext = React.createContext<VideoEditorContextValue | null>(null)

export function VideoEditorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatchBase] = React.useReducer(editorHistoryReducer, initialEditorState)
  const [currentFrame, setCurrentFrame] = React.useState(0)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [loopPlayback, setLoopPlayback] = React.useState(false)
  const [playerMuted, setPlayerMuted] = React.useState(false)

  const dispatch = React.useCallback((action: VideoEditorAction) => {
    dispatchBase(action)
  }, [])

  React.useEffect(() => {
    setCurrentFrame((frame) =>
      Math.min(frame, Math.max(0, state.project.settings.durationInFrames - 1))
    )
  }, [state.project.settings.durationInFrames])

  const hydrateProject = React.useCallback((project: EditorProject) => {
    dispatchBase({ type: "LOAD_PROJECT", project })
  }, [])

  const undo = React.useCallback(() => {
    dispatchBase({ type: "UNDO" })
  }, [])

  const redo = React.useCallback(() => {
    dispatchBase({ type: "REDO" })
  }, [])

  const canUndo = state.past.length > 0
  const canRedo = state.future.length > 0

  const value = React.useMemo<VideoEditorContextValue>(
    () => ({
      project: state.project,
      dispatch,
      hydrateProject,
      currentFrame,
      setCurrentFrame,
      isPlaying,
      setIsPlaying,
      loopPlayback,
      setLoopPlayback,
      playerMuted,
      setPlayerMuted,
      canUndo,
      canRedo,
      undo,
      redo,
    }),
    [
      state.project,
      dispatch,
      hydrateProject,
      currentFrame,
      isPlaying,
      loopPlayback,
      playerMuted,
      canUndo,
      canRedo,
      undo,
      redo,
    ]
  )

  return (
    <VideoEditorContext.Provider value={value}>{children}</VideoEditorContext.Provider>
  )
}

export function useVideoEditor(): VideoEditorContextValue {
  const ctx = React.useContext(VideoEditorContext)
  if (!ctx) {
    throw new Error("useVideoEditor must be used within VideoEditorProvider")
  }
  return ctx
}
