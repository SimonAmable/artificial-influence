import { Canvas as FabricCanvas, FabricImage, Rect, Line, Group, IText, PencilBrush } from "fabric"
import { CANVAS_SETTINGS, SHAPE_DEFAULTS, TEXT_DEFAULTS } from "./constants"
import type { EditorTool } from "./types"

type BaseAwareObject = {
  id?: string
  name?: string
  layerId?: string
  selectable?: boolean
  evented?: boolean
  lockMovementX?: boolean
  lockMovementY?: boolean
}

function isBackgroundObject(obj: BaseAwareObject): boolean {
  return obj.layerId === "base" || obj.name === "Background Image"
}

function toRgbaColor(color: string, opacity: number): string {
  if (color.startsWith("rgba(")) return color

  if (color.startsWith("rgb(")) {
    const values = color
      .replace("rgb(", "")
      .replace(")", "")
      .split(",")
      .map((value) => Number(value.trim()))
    if (values.length === 3) {
      return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${opacity})`
    }
  }

  const hex = color.replace("#", "")
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => char + char)
          .join("")
      : hex

  if (normalized.length !== 6) return color

  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

/**
 * Initialize a new Fabric.js canvas
 */
export function initializeCanvas(
  canvasElement: HTMLCanvasElement,
  width: number,
  height: number
): FabricCanvas {
  const canvas = new FabricCanvas(canvasElement, {
    width,
    height,
    backgroundColor: CANVAS_SETTINGS.backgroundColor,
    selectionColor: CANVAS_SETTINGS.selectionColor,
    selectionBorderColor: CANVAS_SETTINGS.selectionBorderColor,
    selectionLineWidth: CANVAS_SETTINGS.selectionLineWidth,
    preserveObjectStacking: true,
  })

  return canvas
}

/**
 * Load an image onto the canvas
 */
export async function loadImageOntoCanvas(
  canvas: FabricCanvas,
  imageUrl: string
): Promise<FabricImage> {
  const img = await FabricImage.fromURL(imageUrl, { crossOrigin: "anonymous" })

  // Scale image to fit canvas while maintaining aspect ratio
  const canvasWidth = canvas.width!
  const canvasHeight = canvas.height!
  const imgWidth = img.width!
  const imgHeight = img.height!

  const scale = Math.min(
    (canvasWidth * 0.9) / imgWidth,
    (canvasHeight * 0.9) / imgHeight,
    1 // Don't scale up
  )

  img.scale(scale)
  img.set({
    left: (canvasWidth - imgWidth * scale) / 2,
    top: (canvasHeight - imgHeight * scale) / 2,
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
    lockMovementX: true,
    lockMovementY: true,
  })

  // Add custom properties for layer management
  const metaImage = img as FabricImage & BaseAwareObject
  metaImage.id = `image-${Date.now()}`
  metaImage.name = "Background Image"
  metaImage.layerId = "base"

  canvas.add(img)
  canvas.sendObjectToBack(img)
  canvas.renderAll()

  return img
}

/**
 * Configure brush tool
 */
export function configureBrush(
  canvas: FabricCanvas,
  color: string,
  size: number,
  opacity: number = 1
): void {
  const brush = new PencilBrush(canvas)
  brush.color = toRgbaColor(color, opacity)
  brush.width = size
  canvas.freeDrawingBrush = brush
}

/**
 * Add a rectangle shape
 */
export function addRectangle(
  canvas: FabricCanvas,
  x: number,
  y: number
): Rect {
  const rect = new Rect({
    left: x,
    top: y,
    ...SHAPE_DEFAULTS.rectangle,
  })
  const metaRect = rect as Rect & BaseAwareObject
  metaRect.id = `rect-${Date.now()}`
  metaRect.name = "Rectangle"

  canvas.add(rect)
  canvas.setActiveObject(rect)
  canvas.renderAll()

  return rect
}

/**
 * Add an arrow (line with arrowhead)
 */
export function addArrow(
  canvas: FabricCanvas,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  color: string = SHAPE_DEFAULTS.arrow.stroke,
  strokeWidth: number = SHAPE_DEFAULTS.arrow.strokeWidth
): Group {
  const angle = Math.atan2(endY - startY, endX - startX)
  const headLength = 15
  const headAngle = Math.PI / 6

  // Main line
  const line = new Line([startX, startY, endX, endY], {
    stroke: color,
    strokeWidth,
  })

  // Arrowhead lines
  const head1 = new Line([
    endX,
    endY,
    endX - headLength * Math.cos(angle - headAngle),
    endY - headLength * Math.sin(angle - headAngle),
  ], {
    stroke: color,
    strokeWidth,
  })

  const head2 = new Line([
    endX,
    endY,
    endX - headLength * Math.cos(angle + headAngle),
    endY - headLength * Math.sin(angle + headAngle),
  ], {
    stroke: color,
    strokeWidth,
  })

  const arrow = new Group([line, head1, head2], {
    left: Math.min(startX, endX),
    top: Math.min(startY, endY),
  })
  const metaArrow = arrow as Group & BaseAwareObject
  metaArrow.id = `arrow-${Date.now()}`
  metaArrow.name = "Arrow"

  canvas.add(arrow)
  canvas.setActiveObject(arrow)
  canvas.renderAll()

  return arrow
}

/**
 * Add text
 */
export function addText(
  canvas: FabricCanvas,
  x: number,
  y: number,
  text: string = "Double-click to edit"
): IText {
  const textObj = new IText(text, {
    left: x,
    top: y,
    ...TEXT_DEFAULTS,
  })
  const metaText = textObj as IText & BaseAwareObject
  metaText.id = `text-${Date.now()}`
  metaText.name = "Text"

  canvas.add(textObj)
  canvas.setActiveObject(textObj)
  canvas.renderAll()

  return textObj
}

/**
 * Delete selected objects
 */
export function deleteSelected(canvas: FabricCanvas): void {
  const activeObjects = canvas.getActiveObjects()
  if (activeObjects.length > 0) {
    activeObjects.forEach((obj) => {
      canvas.remove(obj)
    })
    canvas.discardActiveObject()
    canvas.renderAll()
  }
}

/**
 * Set the canvas mode based on tool
 */
export function setCanvasMode(canvas: FabricCanvas, tool: EditorTool): void {
  // Disable drawing mode by default
  canvas.isDrawingMode = false
  canvas.skipTargetFind = false

  // Enable selection by default
  canvas.selection = true
  canvas.forEachObject((obj) => {
    const current = obj as unknown as BaseAwareObject
    if (isBackgroundObject(current)) {
      obj.selectable = false
      obj.evented = false
      return
    }

    obj.selectable = true
    obj.evented = true
  })

  switch (tool) {
    case "brush":
    case "lasso":
      canvas.isDrawingMode = true
      canvas.selection = false
      canvas.skipTargetFind = true
      break
    case "select":
      // Default selection mode, nothing extra needed
      break
    case "rectangle":
    case "arrow":
    case "text":
    case "image":
      // These tools need click handlers, managed in canvas component
      // Temporarily disable selection while using these tools
      canvas.selection = false
      canvas.skipTargetFind = true
      canvas.discardActiveObject()
      break
  }

  canvas.renderAll()
}

/**
 * Export canvas to blob
 */
export async function exportCanvasToBlob(
  canvas: FabricCanvas,
  format: "png" | "jpeg" = "png",
  quality: number = 1
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const dataUrl = canvas.toDataURL({
      format,
      quality,
      multiplier: 1,
    })

    fetch(dataUrl)
      .then((res) => res.blob())
      .then(resolve)
      .catch(reject)
  })
}

/**
 * Fit canvas to container
 */
export function fitCanvasToContainer(
  canvas: FabricCanvas,
  containerWidth: number,
  containerHeight: number,
  padding: number = 40
): void {
  const availableWidth = containerWidth - padding * 2
  const availableHeight = containerHeight - padding * 2

  canvas.setDimensions({
    width: availableWidth,
    height: availableHeight,
  })

  canvas.renderAll()
}
