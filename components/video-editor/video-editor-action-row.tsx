"use client"

import {
  ArrowCounterClockwise,
  ArrowClockwise,
  DownloadSimple,
  FolderOpen,
  Magnet,
  Scissors,
  Square,
  TextT,
  UploadSimple,
} from "@phosphor-icons/react"
import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FEATURE_FLAGS } from "@/lib/video-editor/feature-flags"
import {
  createAudioItem,
  createGifItem,
  createImageItem,
  createSolidItem,
  createTextItem,
  createVideoItem,
} from "@/lib/video-editor/item-factory"
import { fitRectContain } from "@/lib/video-editor/frame-fit"
import {
  getAudioDurationSeconds,
  getImageDimensionsFromFile,
  getVideoDimensions,
  getVideoDurationSeconds,
} from "@/lib/video-editor/media-parser"
import { useVideoEditor } from "@/components/video-editor/video-editor-provider"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { cn } from "@/lib/utils"

type VideoEditorActionRowProps = {
  className?: string
  renderStatusText?: string | null
  renderOutputUrl?: string | null
  renderButtonLabel?: string
  isSaving?: boolean
  isQueueingRender?: boolean
  isRenderInFlight?: boolean
  onQueueRender?: () => void
  onSaveProject?: () => void
}

export function VideoEditorActionRow({
  className,
  renderStatusText = null,
  renderOutputUrl = null,
  renderButtonLabel = "Render MP4",
  isSaving = false,
  isQueueingRender = false,
  isRenderInFlight = false,
  onQueueRender,
  onSaveProject,
}: VideoEditorActionRowProps) {
  const {
    project,
    dispatch,
    currentFrame,
    setCurrentFrame,
    isPlaying,
    setIsPlaying,
    loopPlayback,
    setLoopPlayback,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useVideoEditor()

  const fileRef = React.useRef<HTMLInputElement>(null)
  const trackId = project.activeTrackId ?? project.tracks[0]?.id

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !trackId) return

    try {
      const up = await uploadFileToSupabase(file, "editor-assets")
      if (!up) return
      const url = up.url
      const fps = project.settings.fps

      if (file.type.startsWith("video/")) {
        const dur = await getVideoDurationSeconds(file)
        const dims = await getVideoDimensions(file).catch(() => ({
          width: project.settings.width,
          height: project.settings.height,
        }))
        const sourceFrames = Math.max(1, Math.ceil(dur * fps))
        let item = createVideoItem(project, url, sourceFrames, { fileName: file.name })
        const fit = fitRectContain(project.settings.width, project.settings.height, dims.width, dims.height)
        item = { ...item, ...fit }
        dispatch({ type: "ADD_ITEM", trackId, item })
      } else if (file.type.startsWith("audio/")) {
        const dur = await getAudioDurationSeconds(file)
        const sourceFrames = Math.max(1, Math.ceil(dur * fps))
        const item = createAudioItem(project, url, sourceFrames, { fileName: file.name })
        dispatch({ type: "ADD_ITEM", trackId, item })
      } else if (file.type.startsWith("image/")) {
        const dims = await getImageDimensionsFromFile(file).catch(() => ({
          width: project.settings.width,
          height: project.settings.height,
        }))
        const fit = fitRectContain(project.settings.width, project.settings.height, dims.width, dims.height)
        if (file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif")) {
          let item = createGifItem(project, url, { fileName: file.name })
          item = { ...item, ...fit }
          dispatch({ type: "ADD_ITEM", trackId, item })
        } else {
          let item = createImageItem(project, url, { fileName: file.name })
          item = { ...item, ...fit }
          dispatch({ type: "ADD_ITEM", trackId, item })
        }
      } else {
        toast.error("Unsupported file type")
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to import asset")
    }
  }

  const addText = () => {
    if (!trackId) return
    dispatch({ type: "ADD_ITEM", trackId, item: createTextItem(project) })
  }

  const addSolid = () => {
    if (!trackId) return
    dispatch({ type: "ADD_ITEM", trackId, item: createSolidItem(project) })
  }

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${project.name.replace(/\s+/g, "-")}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success("Project downloaded")
  }

  const loadJson = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/json"
    input.onchange = () => {
      const f = input.files?.[0]
      if (!f) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result)) as unknown
          dispatch({ type: "LOAD_PROJECT", project: data as typeof project })
          toast.success("Project loaded")
        } catch {
          toast.error("Invalid JSON")
        }
      }
      reader.readAsText(f)
    }
    input.click()
  }

  const splitAtPlayhead = () => {
    const id = project.selectedItemIds[0]
    if (!id) {
      toast.message("Select a clip to split")
      return
    }
    dispatch({ type: "SPLIT_AT_FRAME", itemId: id, frame: currentFrame })
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5",
        className
      )}
    >
      {FEATURE_FLAGS.FEATURE_CREATE_TEXT_TOOL && (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={addText} title="Add text">
          <TextT className="size-4" />
        </Button>
      )}
      {FEATURE_FLAGS.FEATURE_DRAW_SOLID_TOOL && (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={addSolid} title="Add solid">
          <Square className="size-4" />
        </Button>
      )}
      {FEATURE_FLAGS.FEATURE_IMPORT_ASSETS_TOOL && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => fileRef.current?.click()}
            title="Import asset"
          >
            <UploadSimple className="size-4" />
          </Button>
          <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*,audio/*" onChange={handleImport} />
        </>
      )}
      {FEATURE_FLAGS.FEATURE_UNDO_BUTTON && (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={!canUndo} onClick={undo} title="Undo">
          <ArrowCounterClockwise className="size-4" />
        </Button>
      )}
      {FEATURE_FLAGS.FEATURE_REDO_BUTTON && (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={!canRedo} onClick={redo} title="Redo">
          <ArrowClockwise className="size-4" />
        </Button>
      )}
      {FEATURE_FLAGS.FEATURE_SPLIT_ITEM && (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={splitAtPlayhead} title="Split at playhead">
          <Scissors className="size-4" />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8", project.snappingEnabled && "bg-primary/10")}
        onClick={() => dispatch({ type: "SET_SNAPPING", enabled: !project.snappingEnabled })}
        title="Magnetic snap: playhead & clip edges (editing is always frame-accurate)"
      >
        <Magnet className="size-4" />
      </Button>
      {FEATURE_FLAGS.FEATURE_DOWNLOAD_STATE && (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={downloadJson} title="Download project JSON">
          <DownloadSimple className="size-4" />
        </Button>
      )}
      {FEATURE_FLAGS.FEATURE_LOAD_STATE && (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={loadJson} title="Load project JSON">
          <FolderOpen className="size-4" />
        </Button>
      )}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
        {renderStatusText ? (
          <div className="mr-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{renderStatusText}</span>
            {renderOutputUrl ? (
              <a
                href={renderOutputUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Open MP4
              </a>
            ) : null}
          </div>
        ) : null}
        {FEATURE_FLAGS.FEATURE_RENDERING ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8"
            disabled={isSaving || isQueueingRender || isRenderInFlight}
            onClick={onQueueRender}
          >
            {renderButtonLabel}
          </Button>
        ) : null}
        {FEATURE_FLAGS.FEATURE_SAVE_BUTTON ? (
          <Button
            type="button"
            size="sm"
            className="h-8"
            disabled={isSaving}
            onClick={onSaveProject}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        ) : null}
        <Button
          type="button"
          variant={isPlaying ? "secondary" : "default"}
          size="sm"
          className="h-8"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <Button
          type="button"
          variant={loopPlayback ? "secondary" : "ghost"}
          size="sm"
          className="h-8"
          onClick={() => setLoopPlayback(!loopPlayback)}
        >
          Loop
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setCurrentFrame(0)}>
          Start
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => setCurrentFrame(Math.max(0, project.settings.durationInFrames - 1))}
        >
          End
        </Button>
      </div>
    </div>
  )
}
