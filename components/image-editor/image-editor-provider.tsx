"use client"

import * as React from "react"
import type {
  ImageEditorState,
  ImageEditorAction,
  ImageEditorContextType,
  EditorTool,
  MaskMode,
  ImageEditorVariant,
  ImageFilterSettings,
} from "@/lib/image-editor/types"
import { INITIAL_EDITOR_STATE, DEFAULT_IMAGE_FILTER_SETTINGS } from "@/lib/image-editor/constants"
import { textPresetSettingsForCanvas } from "@/lib/image-editor/text-style-presets"
import { serializeCanvas, deserializeCanvas } from "@/lib/image-editor/history-manager"
import {
  getThemeWorkspaceBackgroundColor,
  loadImageOntoCanvas,
  exportCanvasToBlob,
} from "@/lib/image-editor/fabric-utils"
import { applyCanvasCrop } from "@/lib/image-editor/apply-canvas-crop"
import { exportCanvasForCrop } from "@/lib/image-editor/export-utils"
import {
  applyBaseImageFilters,
  readFilterSettingsFromCanvas,
} from "@/lib/image-editor/filter-utils"
import {
  getRememberedFilterSettings,
  setRememberedFilterSettings,
} from "@/lib/image-editor/filter-storage"
import type { CroppedAreaPixels } from "@/lib/utils/crop-image"

// Reducer
function imageEditorReducer(
  state: ImageEditorState,
  action: ImageEditorAction
): ImageEditorState {
  switch (action.type) {
    case "SET_CANVAS":
      return { ...state, canvas: action.canvas }

    case "SET_TOOL":
      return { ...state, activeTool: action.tool }

    case "SET_BRUSH_COLOR":
      return {
        ...state,
        brushSettings: { ...state.brushSettings, color: action.color },
      }

    case "SET_BRUSH_SIZE":
      return {
        ...state,
        brushSettings: { ...state.brushSettings, size: action.size },
      }

    case "SET_BRUSH_OPACITY":
      return {
        ...state,
        brushSettings: { ...state.brushSettings, opacity: action.opacity },
      }

    case "SET_TEXT_SIZE":
      return {
        ...state,
        textSettings: { ...state.textSettings, fontSize: action.size },
      }

    case "SET_TEXT_FONT":
      return {
        ...state,
        textSettings: { ...state.textSettings, fontFamily: action.fontFamily },
      }

    case "SET_TEXT_ALIGN":
      return {
        ...state,
        textSettings: { ...state.textSettings, textAlign: action.textAlign },
      }

    case "SET_TEXT_STROKE_WIDTH":
      return {
        ...state,
        textSettings: { ...state.textSettings, textStrokeWidth: action.width },
      }

    case "SET_TEXT_STROKE_COLOR":
      return {
        ...state,
        textSettings: { ...state.textSettings, textStrokeColor: action.color },
      }

    case "SET_TEXT_STYLE_PRESET": {
      const preset = textPresetSettingsForCanvas(action.presetId, action.canvasWidth)
      return {
        ...state,
        brushSettings: { ...state.brushSettings, color: preset.textFill },
        textSettings: {
          ...state.textSettings,
          stylePresetId: preset.stylePresetId,
          fontFamily: preset.fontFamily,
          fontSize: preset.fontSize,
          textAlign: preset.textAlign,
          textStrokeWidth: preset.textStrokeWidth,
          textStrokeColor: preset.textStrokeColor,
        },
      }
    }

    case "SET_SHAPE_STROKE_WIDTH":
      return {
        ...state,
        shapeSettings: { ...state.shapeSettings, strokeWidth: action.width },
      }

    case "SET_RECTANGLE_FILLED":
      return {
        ...state,
        shapeSettings: { ...state.shapeSettings, rectangleFilled: action.filled },
      }

    case "SET_FILTER_SETTINGS":
      return {
        ...state,
        filterSettings: action.settings,
        ...(action.silent ? {} : { isDirty: true }),
      }

    case "RESET_FILTER_SETTINGS":
      return {
        ...state,
        filterSettings: DEFAULT_IMAGE_FILTER_SETTINGS,
        isDirty: true,
      }

    case "LOAD_IMAGE":
      return {
        ...state,
        currentImage: action.url,
        isDirty: false,
        filterSettings: action.filterSettings,
      }

    case "CLEAR_IMAGE":
      return { ...state, currentImage: null, isDirty: false }

    case "ADD_LAYER":
      return { ...state, layers: [...state.layers, action.layer] }

    case "UPDATE_LAYER":
      return {
        ...state,
        layers: state.layers.map((layer) =>
          layer.id === action.layerId
            ? { ...layer, ...action.updates }
            : layer
        ),
      }

    case "DELETE_LAYER":
      return {
        ...state,
        layers: state.layers.filter((layer) => layer.id !== action.layerId),
        selectedLayerId:
          state.selectedLayerId === action.layerId
            ? null
            : state.selectedLayerId,
      }

    case "SELECT_LAYER":
      return { ...state, selectedLayerId: action.layerId }

    case "REORDER_LAYERS":
      return { ...state, layers: action.layers }

    case "PUSH_HISTORY": {
      // Remove any forward history if we're not at the end
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(action.state)

      // Limit history length
      if (newHistory.length > state.maxHistoryLength) {
        newHistory.shift()
      }

      return {
        ...state,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        isDirty: true,
      }
    }

    case "UNDO": {
      if (state.historyIndex <= 0) return state
      return {
        ...state,
        historyIndex: state.historyIndex - 1,
      }
    }

    case "REDO": {
      if (state.historyIndex >= state.history.length - 1) return state
      return {
        ...state,
        historyIndex: state.historyIndex + 1,
      }
    }

    case "CLEAR_HISTORY":
      return { ...state, history: [], historyIndex: -1 }

    case "SET_ZOOM":
      return { ...state, zoom: action.zoom }

    case "SET_CANVAS_ASPECT_RATIO":
      return { ...state, canvasAspectRatio: action.aspectRatio }

    case "SET_MASK_MODE":
      return { ...state, maskMode: action.mode }

    case "SET_FULLSCREEN":
      return { ...state, isFullscreen: action.isFullscreen }

    case "TOGGLE_LAYERS":
      return { ...state, showLayers: !state.showLayers }

    case "SET_DIRTY":
      return { ...state, isDirty: action.isDirty }

    default:
      return state
  }
}

// Context
const ImageEditorContext = React.createContext<ImageEditorContextType | null>(null)

// Provider Props
interface ImageEditorProviderProps {
  children: React.ReactNode
  initialImage?: string
  variant?: ImageEditorVariant
}

// Provider Component
export function ImageEditorProvider({
  children,
  initialImage,
  variant = "full",
}: ImageEditorProviderProps) {
  const [state, dispatch] = React.useReducer(imageEditorReducer, undefined, () => ({
    ...INITIAL_EDITOR_STATE,
    currentImage: initialImage || null,
    filterSettings: getRememberedFilterSettings(),
    ...(variant === "inpaint"
      ? { activeTool: "lasso" as EditorTool, showLayers: false }
      : {}),
  }))

  // Convenience methods
  const setTool = React.useCallback((tool: EditorTool) => {
    dispatch({ type: "SET_TOOL", tool })
  }, [])

  const setBrushColor = React.useCallback((color: string) => {
    dispatch({ type: "SET_BRUSH_COLOR", color })
  }, [])

  const setBrushSize = React.useCallback((size: number) => {
    dispatch({ type: "SET_BRUSH_SIZE", size })
  }, [])

  const setCanvasAspectRatio = React.useCallback((aspectRatio: number | null) => {
    dispatch({ type: "SET_CANVAS_ASPECT_RATIO", aspectRatio })
  }, [])

  const setMaskMode = React.useCallback((mode: MaskMode) => {
    dispatch({ type: "SET_MASK_MODE", mode })
  }, [])

  const syncFilterSettingsFromCanvas = React.useCallback(() => {
    if (!state.canvas) return
    const settings = readFilterSettingsFromCanvas(state.canvas)
    dispatch({ type: "SET_FILTER_SETTINGS", settings, silent: true })
  }, [state.canvas])

  const setFilterSettings = React.useCallback(
    (
      settings: ImageFilterSettings,
      options?: { saveHistory?: boolean }
    ) => {
      if (!state.canvas) return
      applyBaseImageFilters(state.canvas, settings)
      dispatch({ type: "SET_FILTER_SETTINGS", settings })
      if (options?.saveHistory) {
        setRememberedFilterSettings(settings)
        const serialized = serializeCanvas(state.canvas)
        dispatch({ type: "PUSH_HISTORY", state: serialized })
      }
    },
    [state.canvas]
  )

  const resetFilterSettings = React.useCallback(
    (options?: { saveHistory?: boolean }) => {
      if (!state.canvas) return
      applyBaseImageFilters(state.canvas, DEFAULT_IMAGE_FILTER_SETTINGS)
      dispatch({ type: "RESET_FILTER_SETTINGS" })
      if (options?.saveHistory) {
        setRememberedFilterSettings(DEFAULT_IMAGE_FILTER_SETTINGS)
        const serialized = serializeCanvas(state.canvas)
        dispatch({ type: "PUSH_HISTORY", state: serialized })
      }
    },
    [state.canvas]
  )

  const canUndo = state.historyIndex > 0
  const canRedo = state.historyIndex < state.history.length - 1

  const undo = React.useCallback(async () => {
    if (!state.canvas || state.historyIndex <= 0) return

    const prevIndex = state.historyIndex - 1
    const prevState = state.history[prevIndex]

    if (prevState) {
      await deserializeCanvas(state.canvas, prevState)
      dispatch({ type: "UNDO" })
      syncFilterSettingsFromCanvas()
    }
  }, [state.canvas, state.historyIndex, state.history, syncFilterSettingsFromCanvas])

  const redo = React.useCallback(async () => {
    if (!state.canvas || state.historyIndex >= state.history.length - 1) return

    const nextIndex = state.historyIndex + 1
    const nextState = state.history[nextIndex]

    if (nextState) {
      await deserializeCanvas(state.canvas, nextState)
      dispatch({ type: "REDO" })
      syncFilterSettingsFromCanvas()
    }
  }, [state.canvas, state.historyIndex, state.history, syncFilterSettingsFromCanvas])

  const saveToHistory = React.useCallback(() => {
    if (!state.canvas) return

    const serialized = serializeCanvas(state.canvas)
    dispatch({ type: "PUSH_HISTORY", state: serialized })
  }, [state.canvas])

  const loadImage = React.useCallback(async (url: string) => {
    const canvas = state.canvas
    if (!canvas) return

    try {
      // Clear existing objects
      canvas.clear()
      canvas.set({ backgroundColor: getThemeWorkspaceBackgroundColor() })

      // Load new image
      await loadImageOntoCanvas(canvas, url)

      const remembered = getRememberedFilterSettings()
      dispatch({ type: "LOAD_IMAGE", url, filterSettings: remembered })
      applyBaseImageFilters(canvas, remembered)

      // Save initial state to history
      const serialized = serializeCanvas(canvas)
      dispatch({ type: "CLEAR_HISTORY" })
      dispatch({ type: "PUSH_HISTORY", state: serialized })
    } catch (error) {
      console.error("Failed to load image:", error)
    }
  }, [state.canvas])

  const applyCroppedImage = React.useCallback(
    async (
      sourceImageUrl: string,
      croppedAreaPixels: CroppedAreaPixels
    ): Promise<boolean> => {
      const canvas = state.canvas
      if (!canvas) return false

      const result = await applyCanvasCrop(
        canvas,
        sourceImageUrl,
        croppedAreaPixels
      )
      if (!result) return false

      const nextFilters = state.filterSettings
      dispatch({ type: "LOAD_IMAGE", url: result.url, filterSettings: nextFilters })
      dispatch({ type: "SET_CANVAS_ASPECT_RATIO", aspectRatio: null })
      applyBaseImageFilters(canvas, nextFilters)
      const serialized = serializeCanvas(canvas)
      dispatch({ type: "PUSH_HISTORY", state: serialized })
      return true
    },
    [state.canvas, state.filterSettings]
  )

  const exportImage = React.useCallback(async (format: "png" | "jpeg" = "png"): Promise<Blob | null> => {
    if (!state.canvas) return null

    try {
      return await exportCanvasToBlob(state.canvas, format)
    } catch (error) {
      console.error("Failed to export image:", error)
      return null
    }
  }, [state.canvas])

  const exportImageForCrop = React.useCallback(
    async (format: "png" | "jpeg" = "png"): Promise<Blob | null> => {
      if (!state.canvas) return null

      try {
        return await exportCanvasForCrop(state.canvas, format)
      } catch (error) {
        console.error("Failed to export image for crop:", error)
        return null
      }
    },
    [state.canvas]
  )

  const contextValue: ImageEditorContextType = {
    state,
    dispatch,
    setTool,
    setBrushColor,
    setBrushSize,
    setCanvasAspectRatio,
    setMaskMode,
    setFilterSettings,
    resetFilterSettings,
    undo,
    redo,
    canUndo,
    canRedo,
    saveToHistory,
    loadImage,
    applyCroppedImage,
    exportImage,
    exportImageForCrop,
  }

  return (
    <ImageEditorContext.Provider value={contextValue}>
      {children}
    </ImageEditorContext.Provider>
  )
}

// Hook to use the context
export function useImageEditor(): ImageEditorContextType {
  const context = React.useContext(ImageEditorContext)
  if (!context) {
    throw new Error("useImageEditor must be used within an ImageEditorProvider")
  }
  return context
}
