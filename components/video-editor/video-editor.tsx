"use client"

import * as React from "react"
import { toast } from "sonner"
import { VideoEditorActionRow } from "@/components/video-editor/video-editor-action-row"
import { CanvasPanel } from "@/components/video-editor/canvas/canvas-panel"
import { InspectorPanel } from "@/components/video-editor/inspector/inspector-panel"
import { TimelinePanel } from "@/components/video-editor/timeline/timeline-panel"
import { VideoEditorProvider, useVideoEditor } from "@/components/video-editor/video-editor-provider"
import { FEATURE_FLAGS } from "@/lib/video-editor/feature-flags"
import {
  editorRenderJobApiResponseSchema,
  type EditorRenderJobApiResponse,
} from "@/lib/video-editor/render-jobs"
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
  const [isSaving, setIsSaving] = React.useState(false)
  const [isQueueingRender, setIsQueueingRender] = React.useState(false)
  const [renderJob, setRenderJob] =
    React.useState<EditorRenderJobApiResponse | null>(null)
  const lastRenderedStatusRef = React.useRef<string | null>(null)

  const saveProject = React.useCallback(
    async (
      nextProject: EditorProject,
      options?: { silentSuccess?: boolean }
    ): Promise<string | null> => {
      const parsed = editorProjectSchema.safeParse(nextProject)
      if (!parsed.success) {
        toast.error("Invalid project state")
        return null
      }

      setIsSaving(true)

      try {
        const body = {
          name: nextProject.name,
          state_json: parsed.data,
        }

        if (nextProject.id) {
          const res = await fetch(`/api/editor/projects/${nextProject.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })

          if (!res.ok) {
            throw new Error("Save failed")
          }

          if (!options?.silentSuccess) {
            toast.success("Project saved")
          }

          return nextProject.id
        }

        const res = await fetch("/api/editor/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          throw new Error("Save failed")
        }

        const data = (await res.json()) as { id?: string }
        if (!data.id) {
          throw new Error("Project id missing from save response")
        }

        dispatch({ type: "SET_PROJECT_ID", id: data.id })

        if (!options?.silentSuccess) {
          toast.success("Project created")
        }

        return data.id
      } catch {
        toast.error("Could not save project")
        return null
      } finally {
        setIsSaving(false)
      }
    },
    [dispatch]
  )

  const refreshRenderJob = React.useCallback(
    async (jobId: string): Promise<EditorRenderJobApiResponse | null> => {
      try {
        const res = await fetch(`/api/editor/render/${jobId}`, {
          cache: "no-store",
        })

        if (!res.ok) {
          throw new Error("Could not load render job")
        }

        const parsed = editorRenderJobApiResponseSchema.safeParse(await res.json())
        if (!parsed.success) {
          throw new Error("Render job payload was invalid")
        }

        setRenderJob(parsed.data)
        return parsed.data
      } catch {
        return null
      }
    },
    []
  )

  const queueRender = React.useCallback(async () => {
    setIsQueueingRender(true)

    try {
      const savedProjectId = await saveProject(project, { silentSuccess: true })
      if (!savedProjectId) {
        return
      }

      const res = await fetch("/api/editor/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: savedProjectId }),
      })

      const payload = (await res.json().catch(() => ({}))) as {
        jobId?: string
        error?: string
      }

      if (!res.ok || !payload.jobId) {
        throw new Error(payload.error || "Could not queue render")
      }

      setRenderJob({
        id: payload.jobId,
        status: "queued",
        progress: 0,
        outputUrl: null,
        errorMessage: null,
      })
      lastRenderedStatusRef.current = "queued"
      toast.success("Render queued")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not queue render"
      )
    } finally {
      setIsQueueingRender(false)
    }
  }, [project, saveProject])

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
  }, [
    dispatch,
    isPlaying,
    project,
    redo,
    saveProject,
    setCurrentFrame,
    setIsPlaying,
    undo,
  ])

  React.useEffect(() => {
    if (!renderJob) {
      lastRenderedStatusRef.current = null
      return
    }

    if (renderJob.status === lastRenderedStatusRef.current) {
      return
    }

    if (renderJob.status === "completed") {
      toast.success("Render completed")
    } else if (renderJob.status === "failed") {
      toast.error(renderJob.errorMessage || "Render failed")
    }

    lastRenderedStatusRef.current = renderJob.status
  }, [renderJob])

  React.useEffect(() => {
    if (!renderJob) {
      return
    }

    if (
      renderJob.status !== "queued" &&
      renderJob.status !== "rendering"
    ) {
      return
    }

    let cancelled = false

    const tick = async () => {
      const next = await refreshRenderJob(renderJob.id)
      if (!next || cancelled) {
        return
      }
    }

    void tick()
    const intervalId = window.setInterval(() => {
      void tick()
    }, 2500)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [refreshRenderJob, renderJob])

  const renderButtonLabel = React.useMemo(() => {
    if (isQueueingRender) {
      return "Queueing..."
    }

    if (renderJob?.status === "queued") {
      return "Queued..."
    }

    if (renderJob?.status === "rendering") {
      const progress =
        typeof renderJob.progress === "number"
          ? ` ${Math.max(0, Math.round(renderJob.progress))}%`
          : ""
      return `Rendering${progress}`
    }

    return "Render MP4"
  }, [isQueueingRender, renderJob])

  const renderStatusText = React.useMemo(() => {
    if (!renderJob) {
      return null
    }

    if (renderJob.status === "completed") {
      return "MP4 ready"
    }

    if (renderJob.status === "failed") {
      return renderJob.errorMessage || "Render failed"
    }

    if (renderJob.status === "rendering") {
      return typeof renderJob.progress === "number"
        ? `Rendering ${Math.max(0, Math.round(renderJob.progress))}%`
        : "Rendering"
    }

    return "Queued"
  }, [renderJob])

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      <VideoEditorActionRow
        renderStatusText={renderStatusText}
        renderOutputUrl={renderJob?.status === "completed" ? renderJob.outputUrl : null}
        renderButtonLabel={renderButtonLabel}
        isSaving={isSaving}
        isQueueingRender={isQueueingRender}
        isRenderInFlight={
          renderJob?.status === "queued" || renderJob?.status === "rendering"
        }
        onQueueRender={() => void queueRender()}
        onSaveProject={() => void saveProject(project)}
      />
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
