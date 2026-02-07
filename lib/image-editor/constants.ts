import type {
  EditorTool,
  BrushSettings,
  ImageEditorState,
  TextSettings,
  ShapeSettings,
} from "./types"

// Tool definitions for toolbar
export const TOOLS: { id: EditorTool; label: string; shortcut: string }[] = [
  { id: "select", label: "Select", shortcut: "V" },
  { id: "lasso", label: "Lasso", shortcut: "L" },
  { id: "rectangle", label: "Rectangle", shortcut: "R" },
  { id: "arrow", label: "Arrow", shortcut: "A" },
  { id: "brush", label: "Brush", shortcut: "B" },
  { id: "text", label: "Text", shortcut: "T" },
  { id: "image", label: "Image", shortcut: "I" },
]

// Default brush settings
export const DEFAULT_BRUSH_SETTINGS: BrushSettings = {
  color: "#ffffff",
  size: 10,
  opacity: 1,
}

export const DEFAULT_TEXT_SETTINGS: TextSettings = {
  fontSize: 24,
  fontFamily: "Inter, sans-serif",
}

export const DEFAULT_SHAPE_SETTINGS: ShapeSettings = {
  strokeWidth: 2,
  rectangleFilled: false,
}

// Preset colors for color picker
export const PRESET_COLORS = [
  "#ffffff", // White
  "#000000", // Black
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
]

// Brush size presets
export const BRUSH_SIZES = [2, 5, 10, 20, 40, 80]

// Initial editor state
export const INITIAL_EDITOR_STATE: ImageEditorState = {
  canvas: null,
  activeTool: "select",
  brushSettings: DEFAULT_BRUSH_SETTINGS,
  textSettings: DEFAULT_TEXT_SETTINGS,
  shapeSettings: DEFAULT_SHAPE_SETTINGS,
  currentImage: null,
  layers: [],
  selectedLayerId: null,
  history: [],
  historyIndex: -1,
  maxHistoryLength: 50,
  zoom: 1,
  canvasAspectRatio: null,
  maskMode: "add",
  isFullscreen: false,
  showLayers: true,
  isDirty: false,
}

// Canvas settings
export const CANVAS_SETTINGS = {
  defaultWidth: 800,
  defaultHeight: 600,
  backgroundColor: "#18181b", // zinc-900
  selectionColor: "rgba(139, 92, 246, 0.3)", // purple with opacity
  selectionBorderColor: "#8b5cf6", // purple
  selectionLineWidth: 1,
}

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS: Record<string, EditorTool | "undo" | "redo" | "delete"> = {
  v: "select",
  l: "lasso",
  r: "rectangle",
  a: "arrow",
  b: "brush",
  t: "text",
  i: "image",
}

// Shape defaults
export const SHAPE_DEFAULTS = {
  rectangle: {
    fill: "transparent",
    stroke: "#ffffff",
    strokeWidth: 2,
    width: 100,
    height: 100,
  },
  arrow: {
    stroke: "#ffffff",
    strokeWidth: 2,
    fill: "#ffffff",
  },
}

// Text defaults
export const TEXT_DEFAULTS = {
  fill: "#ffffff",
  fontSize: 24,
  fontFamily: "Inter, sans-serif",
}
