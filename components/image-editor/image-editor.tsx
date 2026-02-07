"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ImageEditorProvider, useImageEditor } from "./image-editor-provider"
import { ImageEditorCanvas } from "./image-editor-canvas"
import { ImageEditorToolbar } from "./image-editor-toolbar"
import { ImageEditorColorPicker } from "./image-editor-color-picker"
import { ImageEditorLayers } from "./image-editor-layers"
import { ImageEditorPromptBar } from "./image-editor-prompt-bar"
import { ImageEditorEmptyState } from "./image-editor-empty-state"
import { uploadEditedImage } from "@/lib/image-editor/export-utils"
import { KEYBOARD_SHORTCUTS } from "@/lib/image-editor/constants"
import type { ImageEditorProps, EditorTool } from "@/lib/image-editor/types"

// Inner component that uses the context
function ImageEditorInner({
  initialImage,
  mode = "page",
  onSave,
  onClose,
  className,
}: ImageEditorProps) {
  const { state, setTool, undo, redo } = useImageEditor()
  const { currentImage, showLayers, canvas } = state
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

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
      if (shortcut && !isCtrl && typeof shortcut === "string" && shortcut !== "undo" && shortcut !== "redo" && shortcut !== "delete") {
        e.preventDefault()
        setTool(shortcut as EditorTool)
        return
      }

      // Escape: Exit fullscreen or close modal
      if (e.key === "Escape") {
        if (isFullscreen) {
          setIsFullscreen(false)
        } else if (mode === "modal" && onClose) {
          onClose()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [undo, redo, setTool, isFullscreen, mode, onClose, toggleFullscreen])

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

  // Handle save
  const handleSave = async () => {
    if (!canvas || !onSave) return

    const url = await uploadEditedImage(canvas)
    if (url) {
      onSave(url)
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex flex-col bg-zinc-950",
        mode === "page" ? "h-full min-h-0" : "h-full min-h-[600px]",
        className
      )}
    >
      {/* Top-left: Color + canvas ratio controls */}
      <div className="absolute left-4 top-0 z-20">
        <ImageEditorColorPicker />
      </div>

      {/* Right side: Layers/object panel */}
      {showLayers && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
          <ImageEditorLayers />
        </div>
      )}

      {/* Main canvas area - always render canvas so it can receive images */}
      <div className="flex-1 min-h-0 relative px-16 py-8 pt-12 pb-40">
        <div className="relative h-full w-full rounded-xl  overflow-hidden">
          <ImageEditorCanvas
            className="absolute inset-0"
            initialImage={initialImage}
          />

          {isGenerating && hasImage && (
            <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
              <div
                className="absolute inset-y-0 -left-1/2 w-1/2"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0) 100%)",
                  animation: "editorGenerateSweep 20s linear infinite",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
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
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3">
        {/* Toolbar */}
        <ImageEditorToolbar
          onToggleFullscreen={toggleFullscreen}
          isFullscreen={isFullscreen}
        />

        {/* Prompt bar */}
        <ImageEditorPromptBar onGeneratingChange={setIsGenerating} />
      </div>

      {/* Save button (modal mode) */}
      {mode === "modal" && onSave && hasImage && (
        <div className="absolute top-4 right-56 z-20">
          <button
            onClick={handleSave}
            className={cn(
              "px-4 py-2 rounded-lg",
              "bg-primary hover:bg-primary/90",
              "text-primary-foreground text-sm font-medium",
              "transition-colors"
            )}
          >
            Save Changes
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
}: ImageEditorProps) {
  return (
    <ImageEditorProvider initialImage={initialImage}>
      <ImageEditorInner
        initialImage={initialImage}
        mode={mode}
        onSave={onSave}
        onClose={onClose}
        className={className}
      />
    </ImageEditorProvider>
  )
}
