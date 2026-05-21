"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImageEditorProvider, useImageEditor } from "./image-editor-provider"
import { ImageEditorCanvas } from "./image-editor-canvas"
import { ImageEditorToolbar } from "./image-editor-toolbar"
import { ImageEditorColorPicker } from "./image-editor-color-picker"
import { ImageEditorInpaintBrushBar } from "./image-editor-inpaint-brush-bar"
import { ImageEditorLayers } from "./image-editor-layers"
import { ImageEditorPromptBar } from "./image-editor-prompt-bar"
import { ImageEditorEmptyState } from "./image-editor-empty-state"
import { ImageEditorGoogleFontsLink } from "./image-editor-google-fonts-link"
import { DownloadSimple } from "@phosphor-icons/react"
import { downloadCanvas, uploadEditedImage } from "@/lib/image-editor/export-utils"
import { KEYBOARD_SHORTCUTS } from "@/lib/image-editor/constants"
import type { ImageEditorProps, EditorTool } from "@/lib/image-editor/types"

type EditorSurfaceTab = "inpaint" | "image-editor"

// Inner component that uses the context
function ImageEditorInner({
  initialImage,
  mode = "page",
  onSave,
  onClose,
  className,
  variant = "full",
}: ImageEditorProps) {
  const pathname = usePathname()
  const { state, setTool, setMaskMode, undo, redo, dispatch } = useImageEditor()
  const { currentImage, showLayers, canvas, activeTool } = state
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [surfaceTab, setSurfaceTab] = React.useState<EditorSurfaceTab>(() => {
    if (mode !== "page" || variant !== "inpaint") return "inpaint"
    if (pathname?.includes("/image-editor")) return "image-editor"
    if (pathname?.includes("/inpaint")) return "inpaint"
    return "inpaint"
  })
  const [sidebarChatOpen, setSidebarChatOpen] = React.useState(false)
  const [generateBarOpen, setGenerateBarOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  /** `/inpaint` and `/image-editor` pages use two tabs; this selects full tools vs inpaint-only */
  const splitInpaintPage = mode === "page" && variant === "inpaint"
  const fullEditorSurface =
    variant === "full" || (splitInpaintPage && surfaceTab === "image-editor")

  /** Inpaint tab or standalone inpaint — mask / lasso workflow */
  const inpaintMaskSurface =
    variant === "inpaint" && (!splitInpaintPage || surfaceTab === "inpaint")

  const showColorLayersStrip = fullEditorSurface || inpaintMaskSurface

  const showInpaintTabBrushBar =
    variant === "inpaint" && (!splitInpaintPage || surfaceTab === "inpaint")

  const showFullSurfaceStrokeBar =
    fullEditorSurface &&
    activeTool === "brush" &&
    !(variant === "inpaint" && surfaceTab === "inpaint")

  const canvasBottomPadding = React.useMemo(() => {
    if (sidebarChatOpen) return "pb-52 sm:pb-60"
    if (fullEditorSurface && !generateBarOpen) return "pb-28 sm:pb-36"
    return "pb-40 sm:pb-48"
  }, [fullEditorSurface, generateBarOpen, sidebarChatOpen])

  const toolCanvasHint = React.useMemo(() => {
    if (inpaintMaskSurface && activeTool === "lasso") {
      return "Paint on the canvas to define the inpaint mask."
    }
    if (!fullEditorSurface) return null
    switch (activeTool) {
      case "rectangle":
      case "arrow":
        return "Drag on the canvas to draw."
      case "text":
        return "Drag to set text width; the box stays centered on your click."
      case "brush":
        return "Paint on the canvas."
      case "lasso":
        return null
      case "image":
        return "Choose an image to add as a layer."
      case "select":
        return null
      default: {
        const _never: never = activeTool
        return _never
      }
    }
  }, [activeTool, fullEditorSurface, inpaintMaskSurface])

  React.useLayoutEffect(() => {
    if (!pathname) return
    if (pathname.includes("/image-editor")) {
      setSurfaceTab("image-editor")
    } else if (pathname.includes("/inpaint")) {
      setSurfaceTab("inpaint")
    }
  }, [pathname])

  React.useEffect(() => {
    const onChatVisibility = (e: Event) => {
      const detail = (e as CustomEvent<{ open?: boolean }>).detail
      if (typeof detail?.open === "boolean") {
        setSidebarChatOpen(detail.open)
      }
    }
    window.addEventListener("chat-visibility", onChatVisibility as EventListener)
    return () =>
      window.removeEventListener(
        "chat-visibility",
        onChatVisibility as EventListener,
      )
  }, [])

  React.useEffect(() => {
    if (!splitInpaintPage) return
    if (surfaceTab === "image-editor") {
      setTool("select")
      if (!showLayers) {
        dispatch({ type: "TOGGLE_LAYERS" })
      }
    } else {
      setTool("lasso")
      setMaskMode("add")
      if (showLayers) {
        dispatch({ type: "TOGGLE_LAYERS" })
      }
    }
  }, [
    dispatch,
    setMaskMode,
    setTool,
    showLayers,
    splitInpaintPage,
    surfaceTab,
  ])

  // Track if we have an image (either initial or loaded)
  const hasImage = !!(currentImage || initialImage)

  const toggleFullscreen = React.useCallback(() => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
    setIsFullscreen(!isFullscreen)
  }, [isFullscreen])

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      // Check for modifier keys
      const isCtrl = e.ctrlKey || e.metaKey
      const isShift = e.shiftKey

      // Undo: Ctrl+Z
      if (isCtrl && !isShift && e.key === "z") {
        e.preventDefault()
        undo()
        return
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((isCtrl && isShift && e.key === "z") || (isCtrl && e.key === "y")) {
        e.preventDefault()
        redo()
        return
      }

      // Fullscreen: F
      if (e.key === "f" && !isCtrl) {
        e.preventDefault()
        toggleFullscreen()
        return
      }

      // Tool shortcuts (single letter keys)
      const shortcut = KEYBOARD_SHORTCUTS[e.key.toLowerCase()]
      if (
        shortcut &&
        !isCtrl &&
        typeof shortcut === "string" &&
        shortcut !== "undo" &&
        shortcut !== "redo" &&
        shortcut !== "delete"
      ) {
        if (!fullEditorSurface && variant === "inpaint" && shortcut !== "lasso") {
          return
        }
        if (fullEditorSurface && shortcut === "lasso") {
          return
        }
        e.preventDefault()
        if (shortcut === "lasso") {
          setMaskMode("add")
        }
        setTool(shortcut as EditorTool)
        return
      }

      // Escape: Exit fullscreen or close modal
      if (e.key === "Escape") {
        if (isFullscreen) {
          setIsFullscreen(false)
          return
        }
        if (mode === "modal" && onClose) {
          onClose()
          return
        }
        if (fullEditorSurface) {
          e.preventDefault()
          setTool("select")
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    fullEditorSurface,
    undo,
    redo,
    setTool,
    setMaskMode,
    isFullscreen,
    mode,
    onClose,
    toggleFullscreen,
    variant,
  ])

  // Handle fullscreen change
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  const saveDownloadsLocally = variant === "inpaint" && mode === "page"
  const showPageSave = mode === "page" && hasImage && (Boolean(onSave) || saveDownloadsLocally)

  const handleSave = async () => {
    if (!canvas || isSaving) return

    if (saveDownloadsLocally) {
      downloadCanvas(canvas, `inpaint-${Date.now()}`)
      onSave?.("")
      return
    }

    if (!onSave) return

    setIsSaving(true)
    try {
      const url = await uploadEditedImage(canvas)
      if (url) {
        onSave(url)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const pageSaveButton = showPageSave ? (
    <button
      type="button"
      onClick={() => void handleSave()}
      disabled={!canvas || isSaving}
      title="Download image"
      aria-label="Download image"
      className={cn(
        "flex h-8 min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary px-3 text-sm font-semibold text-primary-foreground backdrop-blur-md transition-colors",
        "hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      )}
    >
      <DownloadSimple size={16} weight="bold" aria-hidden />
      {isSaving ? "Saving…" : "Save"}
    </button>
  ) : null

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex flex-col bg-background w-full min-w-0 flex-1",
        mode === "page" ? "h-full min-h-0" : "h-full min-h-[600px]",
        className
      )}
    >
      {/* Main canvas area - always render canvas so it can receive images */}
      <div
        className={cn(
          "relative flex min-h-0 w-full min-w-0 flex-1 flex-col px-2 py-4 sm:px-4 sm:py-6 md:px-6",
          canvasBottomPadding
        )}
      >
        {mode === "page" && variant === "inpaint" && (
          <div className="mb-3 flex w-full shrink-0 justify-center">
            <Tabs
              value={surfaceTab}
              onValueChange={(v) => setSurfaceTab(v as EditorSurfaceTab)}
              className="mx-auto flex w-full max-w-md flex-col items-stretch sm:max-w-lg"
            >
              <TabsList
                variant="default"
                className={cn(
                  "!mx-auto grid !h-auto min-h-11 w-full max-w-md grid-cols-2 gap-1 rounded-4xl p-1 sm:max-w-lg",
                  "border border-border/65 bg-muted/95",
                  "shadow-[inset_0_2px_6px_rgba(0,0,0,0.10),inset_0_1px_2px_rgba(0,0,0,0.06),inset_0_-1px_1px_rgba(255,255,255,0.35)]",
                  "dark:border-border/45 dark:bg-muted/55",
                  "dark:shadow-[inset_0_2px_12px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(0,0,0,0.45),inset_0_-1px_0_rgba(255,255,255,0.04)]"
                )}
              >
                <TabsTrigger
                  value="inpaint"
                  className="flex min-h-9 w-full min-w-0 shrink-0 items-center justify-center rounded-2xl border border-transparent px-1.5 py-2 text-center text-xs font-medium text-muted-foreground transition-[color,box-shadow,border-color,background-color] hover:text-foreground data-active:border-border/80 data-active:bg-background data-active:text-foreground data-active:shadow-sm dark:data-active:border-border/60 dark:data-active:bg-card/90 sm:px-3 sm:text-sm"
                >
                  Inpaint
                </TabsTrigger>
                <TabsTrigger
                  value="image-editor"
                  className="flex min-h-9 w-full min-w-0 shrink-0 items-center justify-center rounded-2xl border border-transparent px-1.5 py-2 text-center text-xs font-medium text-muted-foreground transition-[color,box-shadow,border-color,background-color] hover:text-foreground data-active:border-border/80 data-active:bg-background data-active:text-foreground data-active:shadow-sm dark:data-active:border-border/60 dark:data-active:bg-card/90 sm:px-3 sm:text-sm"
                >
                  Image Editor
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Color + layers: full editor, or inpaint mask surface (mask colors / brush tuning) */}
        {showColorLayersStrip && (
          <div className="mb-2 flex w-full min-w-0 shrink-0 flex-col items-stretch gap-1.5">
            <div className="flex min-h-8 w-full min-w-0 flex-col gap-2 sm:h-8 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex min-h-8 min-w-0 flex-1 flex-col gap-1 sm:max-w-[min(100%,calc(100%-12rem))]">
                <div className="flex min-h-8 w-full min-w-0 flex-row items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <ImageEditorColorPicker />
                  </div>
                  {(showLayers || showPageSave) && (
                    <div className="flex shrink-0 items-center gap-2 md:hidden">
                      {showLayers ? <ImageEditorLayers variant="sheet" /> : null}
                      {pageSaveButton}
                    </div>
                  )}
                </div>
                {toolCanvasHint ? (
                  <p className="text-[10px] leading-snug text-muted-foreground sm:hidden">
                    {toolCanvasHint}
                  </p>
                ) : null}
              </div>
              {(showLayers || showPageSave) && (
                <div className="hidden shrink-0 items-center justify-end gap-2 md:flex">
                  {showLayers ? <ImageEditorLayers variant="dropdown" /> : null}
                  {pageSaveButton}
                </div>
              )}
            </div>
            <div className="hidden w-full shrink-0 sm:block">
              <p
                className={cn(
                  "text-[11px] leading-snug",
                  toolCanvasHint
                    ? "text-muted-foreground"
                    : "select-none text-transparent",
                )}
                aria-hidden={!toolCanvasHint}
              >
                {toolCanvasHint ?? "\u00a0"}
              </p>
            </div>
          </div>
        )}

        <div className="relative flex-1 min-h-0 w-full rounded-xl overflow-hidden">
          <ImageEditorCanvas
            className="absolute inset-0"
            initialImage={initialImage}
          />

          {isGenerating && hasImage && (
            <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
              <div
                className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-foreground/20 to-transparent"
                style={{
                  animation: "editorGenerateSweep 20s linear infinite",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 via-transparent to-transparent" />
              <style jsx>{`
                @keyframes editorGenerateSweep {
                  0% {
                    transform: translateX(0%);
                  }
                  100% {
                    transform: translateX(300%);
                  }
                }
              `}</style>
            </div>
          )}

          {/* Empty state overlay - shown when no image */}
          {!hasImage && <ImageEditorEmptyState />}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 w-full max-w-5xl px-2 sm:px-4">
        <div className="flex w-full min-w-0 flex-row flex-nowrap items-center justify-center gap-2 overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch] sm:gap-3">
          {showInpaintTabBrushBar && (
            <ImageEditorInpaintBrushBar
              inline
              sizeLabel="Mask"
              className="min-w-[min(100%,10rem)] shrink sm:min-w-48"
            />
          )}
          {showFullSurfaceStrokeBar && (
            <ImageEditorInpaintBrushBar
              inline
              sizeLabel="Stroke"
              className="min-w-[min(100%,10rem)] shrink sm:min-w-48 sm:max-w-xs"
            />
          )}
          <div className="flex shrink-0 items-center justify-center gap-2">
            <ImageEditorToolbar
              extendedTools={fullEditorSurface}
              onToggleFullscreen={toggleFullscreen}
              isFullscreen={isFullscreen}
              showGenerateBarToggle={mode === "page" && fullEditorSurface}
              generateBarOpen={generateBarOpen}
              onToggleGenerateBar={() => setGenerateBarOpen((v) => !v)}
              showMaskModeToggle={inpaintMaskSurface}
              className="min-w-0 shrink"
            />
          </div>
        </div>

        {/* Prompt bar (full editor surface only: toolbar can hide for more canvas) */}
        {(!fullEditorSurface || generateBarOpen) && (
          <ImageEditorPromptBar
            onGeneratingChange={setIsGenerating}
            variant={fullEditorSurface ? "full" : variant}
          />
        )}
      </div>

      {/* Save button (modal mode) */}
      {mode === "modal" && onSave && hasImage && (
        <div className="absolute top-4 right-56 z-20">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canvas || isSaving}
            className={cn(
              "px-4 py-2 rounded-lg",
              "bg-primary hover:bg-primary/90",
              "text-primary-foreground text-sm font-medium",
              "transition-colors disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            {isSaving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  )
}

// Main exported component with provider
export function ImageEditor({
  initialImage,
  mode = "page",
  onSave,
  onClose,
  className,
  variant = "full",
}: ImageEditorProps) {
  return (
    <ImageEditorProvider initialImage={initialImage} variant={variant}>
      <ImageEditorGoogleFontsLink />
      <ImageEditorInner
        initialImage={initialImage}
        mode={mode}
        onSave={onSave}
        onClose={onClose}
        className={className}
        variant={variant}
      />
    </ImageEditorProvider>
  )
}
