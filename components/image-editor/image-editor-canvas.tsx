"use client"

import * as React from "react"
import {
  Canvas as FabricCanvas,
  FabricImage,
  Line,
  Rect,
  Textbox,
  type FabricObject,
} from "fabric"
import { cn } from "@/lib/utils"
import { useImageEditor } from "./image-editor-provider"
import {
  initializeCanvas,
  setCanvasMode,
  configureBrush,
  addArrow,
  deleteSelected,
  loadImageOntoCanvas,
} from "@/lib/image-editor/fabric-utils"
import { serializeCanvas } from "@/lib/image-editor/history-manager"
import { CANVAS_SETTINGS, SHAPE_DEFAULTS } from "@/lib/image-editor/constants"
import type { EditorTool } from "@/lib/image-editor/types"

interface ImageEditorCanvasProps {
  className?: string
  initialImage?: string
}

type FabricMouseEvent = {
  e: MouseEvent | TouchEvent | PointerEvent
}

type FabricPathCreatedEvent = {
  path?: FabricObject
}

type EditableFabricObject = FabricObject & {
  isEditing?: boolean
}

type MetaFabricObject = FabricObject & {
  id?: string
  name?: string
  layerId?: string
}

type BaseImageObject = FabricObject & {
  type: "image"
  name?: string
  layerId?: string
  width?: number
  height?: number
  scaleX?: number
  scaleY?: number
  set: (key: string | Record<string, unknown>, value?: unknown) => void
}

type MaskOverlayObject = FabricObject & {
  id?: string
  name?: string
  __isMaskOverlay?: boolean
}

type CanvasWithMaskStore = FabricCanvas & {
  __maskWorkCanvas?: FabricCanvas
}

const MASK_OVERLAY_ID = "mask-overlay"
const MASK_OVERLAY_NAME = "Mask"
const MASK_OVERLAY_OPACITY = 0.24
const MASK_COLOR_FALLBACK = "#06b6d4"

export function ImageEditorCanvas({ className, initialImage }: ImageEditorCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const fabricCanvasRef = React.useRef<FabricCanvas | null>(null)
  const isDrawingShape = React.useRef(false)
  const shapeStartPoint = React.useRef<{ x: number; y: number } | null>(null)
  const hasLoadedInitialImage = React.useRef(false)
  const draftRectRef = React.useRef<Rect | null>(null)
  const draftArrowLineRef = React.useRef<Line | null>(null)
  const draftTextRef = React.useRef<Textbox | null>(null)
  const activeToolRef = React.useRef<EditorTool>("select")
  const previousToolRef = React.useRef<EditorTool>("select")
  const imageUploadInputRef = React.useRef<HTMLInputElement>(null)
  const maskModeRef = React.useRef<"add" | "erase">("add")
  const maskWorkCanvasRef = React.useRef<FabricCanvas | null>(null)
  const maskRenderVersionRef = React.useRef(0)

  const { state, dispatch, saveToHistory, loadImage, setTool } = useImageEditor()
  const {
    activeTool,
    brushSettings,
    textSettings,
    shapeSettings,
    canvasAspectRatio,
    maskMode,
  } = state

  React.useEffect(() => {
    activeToolRef.current = activeTool
  }, [activeTool])

  React.useEffect(() => {
    if (activeTool === "image" && previousToolRef.current !== "image") {
      imageUploadInputRef.current?.click()
    }
    previousToolRef.current = activeTool
  }, [activeTool])

  React.useEffect(() => {
    maskModeRef.current = maskMode
  }, [maskMode])

  const getPrimaryColor = React.useCallback((): string => {
    if (typeof window === "undefined") return MASK_COLOR_FALLBACK

    const probe = document.createElement("span")
    probe.style.position = "fixed"
    probe.style.left = "-9999px"
    probe.style.color = "var(--primary)"
    document.body.appendChild(probe)

    const resolved = window.getComputedStyle(probe).color
    document.body.removeChild(probe)

    return resolved || MASK_COLOR_FALLBACK
  }, [])

  const getMaskOverlay = React.useCallback((canvas: FabricCanvas): MaskOverlayObject | null => {
    const objects = canvas.getObjects() as Array<FabricObject & Partial<MaskOverlayObject>>
    const overlay = objects.find(
      (obj) =>
        obj.id === MASK_OVERLAY_ID ||
        obj.__isMaskOverlay === true ||
        obj.name === MASK_OVERLAY_NAME
    ) as MaskOverlayObject | undefined
    return overlay ?? null
  }, [])

  const ensureMaskOnTop = React.useCallback(
    (canvas: FabricCanvas) => {
      const overlay = getMaskOverlay(canvas)
      if (!overlay) return
      overlay.set({
        selectable: false,
        evented: false,
      })
      canvas.bringObjectToFront(overlay)
    },
    [getMaskOverlay]
  )

  const renderMaskOverlay = React.useCallback(
    async (canvas: FabricCanvas) => {
      const workCanvas = maskWorkCanvasRef.current
      if (!workCanvas) return

      const version = ++maskRenderVersionRef.current
      const dataUrl = workCanvas.toDataURL({
        format: "png",
        multiplier: 1,
      })

      const image = await FabricImage.fromURL(dataUrl)
      if (version !== maskRenderVersionRef.current) return

      const existingOverlay = getMaskOverlay(canvas)
      if (existingOverlay) {
        canvas.remove(existingOverlay)
      }

      const maskOverlay = image as MaskOverlayObject
      maskOverlay.id = MASK_OVERLAY_ID
      maskOverlay.name = MASK_OVERLAY_NAME
      maskOverlay.__isMaskOverlay = true
      image.set({
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
        opacity: MASK_OVERLAY_OPACITY,
      })

      canvas.add(image)
      ensureMaskOnTop(canvas)
      canvas.requestRenderAll()
    },
    [ensureMaskOnTop, getMaskOverlay]
  )

  const upsertMaskOverlay = React.useCallback(
    (canvas: FabricCanvas, path: FabricObject) => {
      const maskColor = getPrimaryColor()
      const isEraseMode = maskModeRef.current === "erase"
      path.set({
        stroke: isEraseMode ? "rgba(255,255,255,1)" : maskColor,
        fill: undefined,
        opacity: 1,
        selectable: false,
        evented: false,
        globalCompositeOperation: isEraseMode ? "destination-out" : "source-over",
      })

      const workCanvas = maskWorkCanvasRef.current
      if (!workCanvas) {
        canvas.remove(path)
        return
      }

      canvas.remove(path)
      workCanvas.add(path)
      void renderMaskOverlay(canvas)
    },
    [getPrimaryColor, renderMaskOverlay]
  )

  const getPrimaryImageObject = React.useCallback(
    (canvas: FabricCanvas): BaseImageObject | null => {
      const objects = canvas.getObjects() as BaseImageObject[]
      const baseImage =
        objects.find(
          (obj) =>
            obj.type === "image" &&
            (obj.name === "Background Image" || obj.layerId === "base")
        ) || objects.find((obj) => obj.type === "image")

      return baseImage ?? null
    },
    []
  )

  const fitImageToCanvas = React.useCallback((canvas: FabricCanvas, image: BaseImageObject) => {
    const canvasWidth = canvas.width ?? 0
    const canvasHeight = canvas.height ?? 0
    const imageWidth = image.width ?? 0
    const imageHeight = image.height ?? 0

    if (canvasWidth <= 0 || canvasHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
      return
    }

    const scale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight)

    image.set({
      scaleX: scale,
      scaleY: scale,
      left: (canvasWidth - imageWidth * scale) / 2,
      top: (canvasHeight - imageHeight * scale) / 2,
    })
    image.setCoords()
  }, [])

  const assignMeta = React.useCallback(
    (object: MetaFabricObject, prefix: "rect" | "arrow" | "text", label: string) => {
      object.id = `${prefix}-${Date.now()}`
      object.name = label
    },
    []
  )

  const addReferenceImageToCanvas = React.useCallback(
    async (imageUrl: string) => {
      const canvas = fabricCanvasRef.current
      if (!canvas) return

      const image = await FabricImage.fromURL(imageUrl, { crossOrigin: "anonymous" })

      const canvasWidth = canvas.width ?? 0
      const canvasHeight = canvas.height ?? 0
      const imageWidth = image.width ?? 0
      const imageHeight = image.height ?? 0
      if (canvasWidth <= 0 || canvasHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
        return
      }

      const scale = Math.min((canvasWidth * 0.6) / imageWidth, (canvasHeight * 0.6) / imageHeight, 1)

      const object = image as MetaFabricObject
      object.set({
        left: (canvasWidth - imageWidth * scale) / 2,
        top: (canvasHeight - imageHeight * scale) / 2,
        scaleX: scale,
        scaleY: scale,
        selectable: true,
        evented: true,
      })
      object.id = `image-ref-${Date.now()}`
      object.name = "Reference Image"

      canvas.add(object)
      canvas.setActiveObject(object)
      canvas.requestRenderAll()
      saveToHistory()
    },
    [saveToHistory]
  )

  const resizeCanvasToContainer = React.useCallback(() => {
    const container = containerRef.current
    const canvas = fabricCanvasRef.current
    const workCanvas = maskWorkCanvasRef.current
    if (!container || !canvas) return

    const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect()
    if (containerWidth <= 0 || containerHeight <= 0) return

    const imageObject = getPrimaryImageObject(canvas)

    const imageWidth = imageObject?.width ?? 0
    const imageHeight = imageObject?.height ?? 0
    const autoAspectRatio =
      imageWidth > 0 && imageHeight > 0
        ? imageWidth / imageHeight
        : null

    const targetAspectRatio = canvasAspectRatio ?? autoAspectRatio

    if (!targetAspectRatio || targetAspectRatio <= 0) {
      canvas.setDimensions({ width: containerWidth, height: containerHeight })
      workCanvas?.setDimensions({ width: containerWidth, height: containerHeight })
      if (imageObject) {
        fitImageToCanvas(canvas, imageObject)
      }
      canvas.requestRenderAll()
      return
    }

    const containerRatio = containerWidth / containerHeight
    let nextWidth = containerWidth
    let nextHeight = containerHeight

    if (containerRatio > targetAspectRatio) {
      nextHeight = containerHeight
      nextWidth = nextHeight * targetAspectRatio
    } else {
      nextWidth = containerWidth
      nextHeight = nextWidth / targetAspectRatio
    }

    canvas.setDimensions({ width: nextWidth, height: nextHeight })
    workCanvas?.setDimensions({ width: nextWidth, height: nextHeight })
    if (imageObject) {
      fitImageToCanvas(canvas, imageObject)
    }
    canvas.requestRenderAll()
  }, [canvasAspectRatio, fitImageToCanvas, getPrimaryImageObject])

  // Initialize canvas and load initial image
  React.useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return

    const canvas = initializeCanvas(
      canvasRef.current,
      CANVAS_SETTINGS.defaultWidth,
      CANVAS_SETTINGS.defaultHeight
    )
    const maskCanvasElement = document.createElement("canvas")
    const maskWorkCanvas = initializeCanvas(
      maskCanvasElement,
      CANVAS_SETTINGS.defaultWidth,
      CANVAS_SETTINGS.defaultHeight
    )
    maskWorkCanvas.backgroundColor = "transparent"
    maskWorkCanvas.selection = false

    fabricCanvasRef.current = canvas
    ;(canvas as CanvasWithMaskStore).__maskWorkCanvas = maskWorkCanvas
    maskWorkCanvasRef.current = maskWorkCanvas
    dispatch({ type: "SET_CANVAS", canvas })

    // Handle object modifications
    const handleModified = () => {
      ensureMaskOnTop(canvas)
      saveToHistory()
    }

    const handlePathCreated = (event: FabricPathCreatedEvent) => {
      const createdPath = event.path
      if (!createdPath) {
        saveToHistory()
        return
      }

      if (activeToolRef.current === "lasso") {
        upsertMaskOverlay(canvas, createdPath)
      }

      ensureMaskOnTop(canvas)
      saveToHistory()
    }

    const handleObjectAdded = () => {
      ensureMaskOnTop(canvas)
    }

    canvas.on("object:modified", handleModified)
    canvas.on("path:created", handlePathCreated)
    canvas.on("object:added", handleObjectAdded)

    // Load initial image if provided
    if (initialImage && !hasLoadedInitialImage.current) {
      hasLoadedInitialImage.current = true
      loadImageOntoCanvas(canvas, initialImage)
        .then(() => {
          dispatch({ type: "LOAD_IMAGE", url: initialImage })
          resizeCanvasToContainer()
          // Save initial state to history
          const serialized = serializeCanvas(canvas)
          dispatch({ type: "CLEAR_HISTORY" })
          dispatch({ type: "PUSH_HISTORY", state: serialized })
        })
        .catch((err) => {
          console.error("Failed to load initial image:", err)
        })
    } else {
      // Save empty state to history
      const serialized = serializeCanvas(canvas)
      dispatch({ type: "PUSH_HISTORY", state: serialized })
    }

    return () => {
      canvas.off("object:modified", handleModified)
      canvas.off("path:created", handlePathCreated)
      canvas.off("object:added", handleObjectAdded)
      canvas.dispose()
      maskWorkCanvas.dispose()
      fabricCanvasRef.current = null
      maskWorkCanvasRef.current = null
      dispatch({ type: "SET_CANVAS", canvas: null })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle tool changes
  React.useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    setCanvasMode(canvas, activeTool)
  }, [activeTool])

  // Handle brush settings changes
  React.useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    if (activeTool === "brush") {
      configureBrush(canvas, brushSettings.color, brushSettings.size, brushSettings.opacity)
      return
    }

    if (activeTool === "lasso") {
      const primaryColor = getPrimaryColor()
      const isEraseMode = maskMode === "erase"
      configureBrush(
        canvas,
        isEraseMode ? "#ffffff" : primaryColor,
        Math.max(16, brushSettings.size),
        MASK_OVERLAY_OPACITY
      )
    }
  }, [brushSettings, activeTool, getPrimaryColor, maskMode])

  // Handle mouse events for shape tools
  React.useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    const handleMouseDown = (e: FabricMouseEvent) => {
      if (activeTool === "rectangle" || activeTool === "arrow" || activeTool === "text") {
        const pointer = canvas.getViewportPoint(e.e)
        shapeStartPoint.current = { x: pointer.x, y: pointer.y }
        isDrawingShape.current = true

        if (activeTool === "rectangle") {
          const rect = new Rect({
            left: pointer.x,
            top: pointer.y,
            width: 1,
            height: 1,
            fill: shapeSettings.rectangleFilled
              ? brushSettings.color
              : SHAPE_DEFAULTS.rectangle.fill,
            stroke: brushSettings.color,
            strokeWidth: shapeSettings.strokeWidth,
            selectable: false,
            evented: false,
          })
          assignMeta(rect as MetaFabricObject, "rect", "Rectangle")
          canvas.add(rect)
          draftRectRef.current = rect
        } else if (activeTool === "arrow") {
          const line = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: brushSettings.color,
            strokeWidth: shapeSettings.strokeWidth,
            selectable: false,
            evented: false,
          })
          canvas.add(line)
          draftArrowLineRef.current = line
        } else if (activeTool === "text") {
          const textBox = new Textbox("Type here", {
            left: pointer.x,
            top: pointer.y,
            width: 1,
            fill: brushSettings.color,
            fontSize: textSettings.fontSize,
            fontFamily: textSettings.fontFamily,
            selectable: false,
            evented: false,
            editable: true,
          })
          assignMeta(textBox as MetaFabricObject, "text", "Text")
          canvas.add(textBox)
          draftTextRef.current = textBox
        }
      }
    }

    const handleMouseMove = (e: FabricMouseEvent) => {
      if (!isDrawingShape.current || !shapeStartPoint.current) return

      const pointer = canvas.getViewportPoint(e.e)
      const start = shapeStartPoint.current

      if (activeTool === "rectangle" && draftRectRef.current) {
        const width = Math.max(1, Math.abs(pointer.x - start.x))
        const height = Math.max(1, Math.abs(pointer.y - start.y))

        draftRectRef.current.set({
          left: Math.min(start.x, pointer.x),
          top: Math.min(start.y, pointer.y),
          width,
          height,
        })
        draftRectRef.current.setCoords()
        canvas.requestRenderAll()
      } else if (activeTool === "arrow" && draftArrowLineRef.current) {
        draftArrowLineRef.current.set({
          x2: pointer.x,
          y2: pointer.y,
        })
        draftArrowLineRef.current.setCoords()
        canvas.requestRenderAll()
      } else if (activeTool === "text" && draftTextRef.current) {
        const width = Math.max(40, Math.abs(pointer.x - start.x))
        draftTextRef.current.set({
          left: pointer.x >= start.x ? start.x : pointer.x,
          width,
        })
        draftTextRef.current.setCoords()
        canvas.requestRenderAll()
      }
    }

    const handleMouseUp = (e: FabricMouseEvent) => {
      if (!isDrawingShape.current || !shapeStartPoint.current) return

      const pointer = canvas.getViewportPoint(e.e)
      const start = shapeStartPoint.current

      if (activeTool === "rectangle") {
        const rect = draftRectRef.current
        if (rect) {
          rect.set({
            selectable: true,
            evented: true,
          })
          rect.setCoords()
          canvas.setActiveObject(rect)
          canvas.requestRenderAll()
          saveToHistory()
        }
      } else if (activeTool === "arrow") {
        const guide = draftArrowLineRef.current
        if (guide) {
          canvas.remove(guide)
        }

        const dx = pointer.x - start.x
        const dy = pointer.y - start.y
        const isClick = Math.hypot(dx, dy) < 4
        const endX = isClick ? start.x + 120 : pointer.x
        const endY = isClick ? start.y : pointer.y

        addArrow(
          canvas,
          start.x,
          start.y,
          endX,
          endY,
          brushSettings.color,
          shapeSettings.strokeWidth
        )
        saveToHistory()
      } else if (activeTool === "text") {
        const text = draftTextRef.current
        if (text) {
          const currentWidth = text.width ?? 0
          if (currentWidth < 60) {
            text.set({ width: 220 })
          }

          text.set({
            selectable: true,
            evented: true,
          })
          text.setCoords()
          canvas.setActiveObject(text)
          canvas.requestRenderAll()

          window.setTimeout(() => {
            text.enterEditing()
            text.selectAll()
          }, 0)

          saveToHistory()
        }
      }

      draftRectRef.current = null
      draftArrowLineRef.current = null
      draftTextRef.current = null
      isDrawingShape.current = false
      shapeStartPoint.current = null
    }

    canvas.on("mouse:down", handleMouseDown)
    canvas.on("mouse:move", handleMouseMove)
    canvas.on("mouse:up", handleMouseUp)

    return () => {
      canvas.off("mouse:down", handleMouseDown)
      canvas.off("mouse:move", handleMouseMove)
      canvas.off("mouse:up", handleMouseUp)
    }
  }, [
    activeTool,
    assignMeta,
    brushSettings.color,
    saveToHistory,
    shapeSettings.rectangleFilled,
    shapeSettings.strokeWidth,
    textSettings.fontFamily,
    textSettings.fontSize,
  ])

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const canvas = fabricCanvasRef.current
      if (!canvas) return

      // Don't handle shortcuts when typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Delete key
      if (e.key === "Delete" || e.key === "Backspace") {
        const activeObj = canvas.getActiveObject() as EditableFabricObject | null
        // Don't delete if editing text
        if (
          activeObj &&
          (activeObj.type === "i-text" || activeObj.type === "textbox") &&
          activeObj.isEditing
        ) {
          return
        }
        deleteSelected(canvas)
        saveToHistory()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [saveToHistory])

  // Handle resize
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          resizeCanvasToContainer()
        }
      }
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [resizeCanvasToContainer])

  // Re-apply sizing when aspect ratio or image changes
  React.useEffect(() => {
    resizeCanvasToContainer()
  }, [resizeCanvasToContainer, state.currentImage])

  // Reset mask store when a new base image is loaded
  React.useEffect(() => {
    const canvas = fabricCanvasRef.current
    const workCanvas = maskWorkCanvasRef.current
    if (!canvas || !workCanvas) return

    const overlay = getMaskOverlay(canvas)
    if (overlay) {
      canvas.remove(overlay)
      canvas.requestRenderAll()
    }

    workCanvas.clear()
    workCanvas.backgroundColor = "transparent"
    maskRenderVersionRef.current += 1
  }, [state.currentImage, getMaskOverlay])

  // Handle file drop
  const handleDrop = React.useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer.files
    if (files.length === 0) return

    const file = files[0]
    if (!file.type.startsWith("image/")) return

    const objectUrl = URL.createObjectURL(file)
    try {
      await loadImage(objectUrl)
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }, [loadImage])

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleImageToolInputChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !file.type.startsWith("image/")) {
        e.target.value = ""
        setTool("select")
        return
      }

      const objectUrl = URL.createObjectURL(file)
      try {
        await addReferenceImageToCanvas(objectUrl)
      } finally {
        URL.revokeObjectURL(objectUrl)
        e.target.value = ""
        setTool("select")
      }
    },
    [addReferenceImageToCanvas, setTool]
  )

  // Get cursor based on tool
  const getCursor = () => {
    switch (activeTool) {
      case "brush":
      case "lasso":
        return "crosshair"
      case "text":
        return "text"
      case "rectangle":
      case "arrow":
        return "crosshair"
      default:
        return "default"
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex items-center justify-center bg-zinc-950 overflow-hidden",
        className
      )}
      style={{ cursor: getCursor() }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <input
        ref={imageUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageToolInputChange}
      />
      <canvas ref={canvasRef} className="block" />
    </div>
  )
}
