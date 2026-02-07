// Main components
export { ImageEditor } from "./image-editor"
export { ImageEditorDialog } from "./image-editor-dialog"

// Sub-components (for custom layouts)
export { ImageEditorProvider, useImageEditor } from "./image-editor-provider"
export { ImageEditorCanvas } from "./image-editor-canvas"
export { ImageEditorToolbar } from "./image-editor-toolbar"
export { ImageEditorColorPicker } from "./image-editor-color-picker"
export { ImageEditorLayers } from "./image-editor-layers"
export { ImageEditorPromptBar } from "./image-editor-prompt-bar"
export { ImageEditorEmptyState } from "./image-editor-empty-state"

// Types
export type {
  ImageEditorProps,
  ImageEditorDialogProps,
  EditorTool,
  EditorLayer,
  BrushSettings,
} from "@/lib/image-editor/types"
