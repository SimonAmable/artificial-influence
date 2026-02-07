import type { Canvas as FabricCanvas } from "fabric"

// Tool types
export type EditorTool =
  | "select"
  | "lasso"
  | "rectangle"
  | "arrow"
  | "brush"
  | "text"
  | "image"

export type MaskMode = "add" | "erase"

// Brush settings
export interface BrushSettings {
  color: string
  size: number
  opacity: number
}

export interface TextSettings {
  fontSize: number
  fontFamily: string
}

export interface ShapeSettings {
  strokeWidth: number
  rectangleFilled: boolean
}

// Layer definition
export interface EditorLayer {
  id: string
  name: string
  type: "image" | "drawing" | "text" | "shape"
  visible: boolean
  locked: boolean
  thumbnail?: string
  objectIds: string[] // Fabric object IDs belonging to this layer
}

// Editor state
export interface ImageEditorState {
  // Canvas reference (not serializable, managed via ref)
  canvas: FabricCanvas | null

  // Tool state
  activeTool: EditorTool
  brushSettings: BrushSettings
  textSettings: TextSettings
  shapeSettings: ShapeSettings

  // Image state
  currentImage: string | null
  layers: EditorLayer[]
  selectedLayerId: string | null

  // History state
  history: string[] // JSON serialized canvas states
  historyIndex: number
  maxHistoryLength: number

  // UI state
  zoom: number
  canvasAspectRatio: number | null // null = auto (match image ratio)
  maskMode: MaskMode
  isFullscreen: boolean
  showLayers: boolean
  isDirty: boolean // Has unsaved changes
}

// Action types for reducer
export type ImageEditorAction =
  | { type: "SET_CANVAS"; canvas: FabricCanvas | null }
  | { type: "SET_TOOL"; tool: EditorTool }
  | { type: "SET_BRUSH_COLOR"; color: string }
  | { type: "SET_BRUSH_SIZE"; size: number }
  | { type: "SET_BRUSH_OPACITY"; opacity: number }
  | { type: "SET_TEXT_SIZE"; size: number }
  | { type: "SET_TEXT_FONT"; fontFamily: string }
  | { type: "SET_SHAPE_STROKE_WIDTH"; width: number }
  | { type: "SET_RECTANGLE_FILLED"; filled: boolean }
  | { type: "LOAD_IMAGE"; url: string }
  | { type: "CLEAR_IMAGE" }
  | { type: "ADD_LAYER"; layer: EditorLayer }
  | { type: "UPDATE_LAYER"; layerId: string; updates: Partial<EditorLayer> }
  | { type: "DELETE_LAYER"; layerId: string }
  | { type: "SELECT_LAYER"; layerId: string | null }
  | { type: "REORDER_LAYERS"; layers: EditorLayer[] }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "PUSH_HISTORY"; state: string }
  | { type: "CLEAR_HISTORY" }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SET_CANVAS_ASPECT_RATIO"; aspectRatio: number | null }
  | { type: "SET_MASK_MODE"; mode: MaskMode }
  | { type: "SET_FULLSCREEN"; isFullscreen: boolean }
  | { type: "TOGGLE_LAYERS" }
  | { type: "SET_DIRTY"; isDirty: boolean }

// Context type
export interface ImageEditorContextType {
  state: ImageEditorState
  dispatch: React.Dispatch<ImageEditorAction>
  // Convenience methods
  setTool: (tool: EditorTool) => void
  setBrushColor: (color: string) => void
  setBrushSize: (size: number) => void
  setCanvasAspectRatio: (aspectRatio: number | null) => void
  setMaskMode: (mode: MaskMode) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  saveToHistory: () => void
  loadImage: (url: string) => Promise<void>
  exportImage: (format?: "png" | "jpeg") => Promise<Blob | null>
}

// Props for main editor component
export interface ImageEditorProps {
  /** Initial image URL to load */
  initialImage?: string
  /** Mode: page for standalone, modal for dialog usage */
  mode?: "page" | "modal"
  /** Callback when image is saved */
  onSave?: (imageUrl: string) => void
  /** Callback when editor is closed (modal mode) */
  onClose?: () => void
  /** Custom class name */
  className?: string
}

// Props for dialog wrapper
export interface ImageEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialImage?: string
  onSave?: (imageUrl: string) => void
}

// Tool definition for toolbar
export interface ToolDefinition {
  id: EditorTool
  label: string
  icon: string // Icon component name
  shortcut?: string
  cursor?: string
}
