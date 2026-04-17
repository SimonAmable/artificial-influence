"use client"

import * as React from "react"
import { toast } from "sonner"
import { VideoEditorActionRow } from "@/components/video-editor/video-editor-action-row"
import { CanvasPanel } from "@/components/video-editor/canvas/canvas-panel"
import { InspectorPanel } from "@/components/video-editor/inspector/inspector-panel"
import { TimelinePanel } from "@/components/video-editor/timeline/timeline-panel"
import { VideoEditorProvider, useVideoEditor } from "@/components/video-editor/video-editor-provider"
import { FEATURE_FLAGS } from "@/lib/video-editor/feature-flags"
import { editorProjectSchema } from "@/lib/video-editor/types"
import type { EditorProject } from "@/lib/video-editor/types"

function VideoEditorShell({ initialProjectId }: { initialProjectId?: string | null }) {
  const {
    project,
    dispatch,
    setCurrentFrame,
    setIsPlaying,
    isPlaying,
    undo,
    redo,
    hydrateProject,
  } = useVideoEditor()

  React.useEffect(() => {
    if (!initialProjectId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/editor/projects/${initialProjectId}`)
        if (!res.ok) return
        const row = (await res.json()) as { id?: string; state_json?: unknown }
        const merged = {
          ...(typeof row.state_json === "object" && row.state_json !== null ? row.state_json : {}),
          id: row.id ?? null,
        }
        const parsed = editorProjectSchema.safeParse(merged)
        if (parsed.success && !cancelled) {
          hydrateProject(parsed.data)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initialProjectId, hydrateProject])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if (meta && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault()
        redo()
        return
      }
      if (meta && e.key === "s") {
        e.preventDefault()
        void saveProject(project)
        return
      }
      if (e.key === " " || e.code === "Space") {
        e.preventDefault()
        setIsPlaying(!isPlaying)
        return
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        setCurrentFrame((f) => Math.max(0, f - 1))
        return
      }
      if (e.key === "ArrowRight") {
        e.preventDefault()
        setCurrentFrame((f) => Math.min(project.settings.durationInFrames - 1, f + 1))
        return
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        if (project.selectedItemIds.length > 0) {
          e.preventDefault()
          dispatch({ type: "DELETE_SELECTED" })
        }
      }
      if (FEATURE_FLAGS.FEATURE_SNAPPING_SHORTCUT && e.key === "m" && e.shiftKey) {
        e.preventDefault()
        dispatch({ type: "SET_SNAPPING", enabled: !project.snappingEnabled })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [project, undo, redo, dispatch, setCurrentFrame, setIsPlaying, isPlaying])

  async function saveProject(p: EditorProject) {
    const parsed = editorProjectSchema.safeParse(p)
    if (!parsed.success) {
      toast.error("Invalid project state")
      return
    }
    try {
      const body = {
        name: p.name,
        state_json: parsed.data,
      }
      if (p.id) {
        const res = await fetch(`/api/editor/projects/${p.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error("Save failed")
        toast.success("Project saved")
      } else {
        const res = await fetch("/api/editor/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error("Save failed")
        const data = (await res.json()) as { id?: string }
        if (data.id) {
          dispatch({ type: "SET_PROJECT_ID", id: data.id })
        }
        toast.success("Project created")
      }
    } catch {
      toast.error("Could not save project")
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full min-w-0 flex-col overflow-hidden">
      <div className="flex h-10 items-center justify-between border-b border-border px-3">
        <h1 className="text-sm font-semibold">Video Editor</h1>
        {FEATURE_FLAGS.FEATURE_SAVE_BUTTON && (
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
            onClick={() => void saveProject(project)}
          >
            Save
          </button>
        )}
      </div>
      <VideoEditorActionRow />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <CanvasPanel className="min-h-0 flex-1" />
          <TimelinePanel className="h-[180px] shrink-0" />
        </div>
        <InspectorPanel className="w-72 shrink-0 border-l border-border bg-card" />
      </div>
    </div>
  )
}

export function VideoEditor({ initialProjectId }: { initialProjectId?: string | null }) {
  return (
    <VideoEditorProvider>
      <VideoEditorShell initialProjectId={initialProjectId} />
    </VideoEditorProvider>
  )
}
