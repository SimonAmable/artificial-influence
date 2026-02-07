"use client"

import * as React from "react"
import {
  Eye,
  EyeSlash,
  Lock,
  LockOpen,
  Trash,
  CursorClick,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { useImageEditor } from "./image-editor-provider"
import type { FabricObject } from "fabric"

interface ImageEditorLayersProps {
  className?: string
}

type CanvasObjectMeta = {
  id: string
  name: string
  type: string
  visible: boolean
  locked: boolean
}

type EditorFabricObject = FabricObject & {
  id?: string
  name?: string
  __editorId?: string
}

function getObjectId(object: EditorFabricObject): string {
  if (object.id) return object.id
  if (object.__editorId) return object.__editorId

  object.__editorId = `object-${crypto.randomUUID()}`
  return object.__editorId
}

function getObjectName(object: EditorFabricObject, index: number): string {
  if (object.name) return object.name

  const typeName = object.type || "object"
  return `${typeName.charAt(0).toUpperCase()}${typeName.slice(1)} ${index + 1}`
}

function isObjectLocked(object: EditorFabricObject): boolean {
  return object.selectable === false || object.evented === false
}

function toObjectMeta(
  object: EditorFabricObject,
  index: number
): CanvasObjectMeta {
  return {
    id: getObjectId(object),
    name: getObjectName(object, index),
    type: object.type || "object",
    visible: object.visible !== false,
    locked: isObjectLocked(object),
  }
}

export function ImageEditorLayers({ className }: ImageEditorLayersProps) {
  const { state } = useImageEditor()
  const { canvas } = state

  const [objects, setObjects] = React.useState<CanvasObjectMeta[]>([])
  const [selectedObjectId, setSelectedObjectId] = React.useState<string | null>(
    null
  )
  const animationFrameRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (!canvas) {
      setObjects([])
      setSelectedObjectId(null)
      return
    }

    const syncObjects = () => {
      const fabricObjects = canvas.getObjects() as EditorFabricObject[]
      const metas = [...fabricObjects].reverse().map(toObjectMeta)
      setObjects(metas)

      const activeObject = canvas.getActiveObject() as EditorFabricObject | null
      setSelectedObjectId(activeObject ? getObjectId(activeObject) : null)
    }

    const scheduleSync = () => {
      if (animationFrameRef.current !== null) return

      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = null
        syncObjects()
      })
    }

    canvas.on("object:added", scheduleSync)
    canvas.on("object:removed", scheduleSync)
    canvas.on("object:modified", scheduleSync)
    canvas.on("path:created", scheduleSync)
    canvas.on("selection:created", scheduleSync)
    canvas.on("selection:updated", scheduleSync)
    canvas.on("selection:cleared", scheduleSync)

    syncObjects()

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      canvas.off("object:added", scheduleSync)
      canvas.off("object:removed", scheduleSync)
      canvas.off("object:modified", scheduleSync)
      canvas.off("path:created", scheduleSync)
      canvas.off("selection:created", scheduleSync)
      canvas.off("selection:updated", scheduleSync)
      canvas.off("selection:cleared", scheduleSync)
    }
  }, [canvas])

  const getObjectById = React.useCallback(
    (id: string): EditorFabricObject | null => {
      if (!canvas) return null

      const object = (canvas.getObjects() as EditorFabricObject[]).find(
        (candidate) => getObjectId(candidate) === id
      )
      return object ?? null
    },
    [canvas]
  )

  const handleSelectObject = (id: string) => {
    if (!canvas) return

    const object = getObjectById(id)
    if (!object || object.visible === false) return

    canvas.setActiveObject(object)
    canvas.requestRenderAll()
    setSelectedObjectId(id)
  }

  const handleToggleVisibility = (id: string) => {
    if (!canvas) return

    const object = getObjectById(id)
    if (!object) return

    const isVisible = object.visible !== false
    object.set("visible", !isVisible)

    if (isVisible && canvas.getActiveObject() === object) {
      canvas.discardActiveObject()
    }

    canvas.requestRenderAll()
  }

  const handleToggleLock = (id: string) => {
    if (!canvas) return

    const object = getObjectById(id)
    if (!object) return

    const locked = isObjectLocked(object)
    object.set({
      selectable: locked,
      evented: locked,
    })

    if (!locked && canvas.getActiveObject() === object) {
      canvas.discardActiveObject()
    }

    canvas.requestRenderAll()
  }

  const handleDeleteObject = (id: string) => {
    if (!canvas) return

    const object = getObjectById(id)
    if (!object) return

    canvas.remove(object)
    canvas.requestRenderAll()
  }

  return (
    <div
      className={cn(
        "flex flex-col w-48 bg-zinc-900/90 border border-white/10 rounded-xl backdrop-blur-md overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-xs text-zinc-400 uppercase tracking-wider">
          Objects
        </span>
        <CursorClick size={14} className="text-zinc-500" />
      </div>

      {/* Object list */}
      <div className="flex-1 overflow-y-auto p-1">
        {objects.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-xs text-zinc-600">
            No objects
          </div>
        ) : (
          objects.map((object) => (
            <ObjectItem
              key={object.id}
              object={object}
              isSelected={selectedObjectId === object.id}
              onSelect={() => handleSelectObject(object.id)}
              onToggleVisibility={() => handleToggleVisibility(object.id)}
              onToggleLock={() => handleToggleLock(object.id)}
              onDelete={() => handleDeleteObject(object.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// Object row component
interface ObjectItemProps {
  object: CanvasObjectMeta
  isSelected: boolean
  onSelect: () => void
  onToggleVisibility: () => void
  onToggleLock: () => void
  onDelete: () => void
}

function ObjectItem({
  object,
  isSelected,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onDelete,
}: ObjectItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
        isSelected
          ? "bg-primary/20 ring-1 ring-primary/40"
          : "hover:bg-white/5"
      )}
      onClick={onSelect}
    >
      <div className="w-8 h-6 bg-zinc-800 rounded flex-shrink-0 flex items-center justify-center">
        <span className="text-[9px] uppercase text-zinc-500 tracking-wide">
          {object.type}
        </span>
      </div>

      <span
        className={cn(
          "flex-1 text-xs truncate",
          object.visible ? "text-zinc-300" : "text-zinc-600"
        )}
      >
        {object.name}
      </span>

      <div className="flex items-center gap-0.5">
        <button
          className={cn(
            "p-1 rounded transition-colors",
            object.visible
              ? "text-zinc-400 hover:text-zinc-100"
              : "text-zinc-600 hover:text-zinc-400"
          )}
          onClick={(e) => {
            e.stopPropagation()
            onToggleVisibility()
          }}
          title={object.visible ? "Hide object" : "Show object"}
        >
          {object.visible ? <Eye size={12} /> : <EyeSlash size={12} />}
        </button>

        <button
          className={cn(
            "p-1 rounded transition-colors",
            object.locked
              ? "text-orange-400 hover:text-orange-300"
              : "text-zinc-600 hover:text-zinc-400"
          )}
          onClick={(e) => {
            e.stopPropagation()
            onToggleLock()
          }}
          title={object.locked ? "Unlock object" : "Lock object"}
        >
          {object.locked ? <Lock size={12} /> : <LockOpen size={12} />}
        </button>

        <button
          className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          title="Delete object"
        >
          <Trash size={12} />
        </button>
      </div>
    </div>
  )
}
