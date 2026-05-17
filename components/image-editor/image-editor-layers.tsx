"use client"

import * as React from "react"
import {
  CaretDown,
  CaretUp,
  Eye,
  EyeSlash,
  Lock,
  LockOpen,
  Stack,
  Trash,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { useImageEditor } from "./image-editor-provider"
import type { FabricObject } from "fabric"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

interface ImageEditorLayersProps {
  className?: string
  /** `dropdown` keeps the popover under the trigger; `sheet` uses a bottom drawer (mobile). */
  variant?: "dropdown" | "sheet"
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

interface ObjectListProps {
  objects: CanvasObjectMeta[]
  selectedObjectId: string | null
  onSelectObject: (id: string) => void
  onToggleVisibility: (id: string) => void
  onToggleLock: (id: string) => void
  onDeleteObject: (id: string) => void
  comfortable?: boolean
}

function ObjectList({
  objects,
  selectedObjectId,
  onSelectObject,
  onToggleVisibility,
  onToggleLock,
  onDeleteObject,
  comfortable = false,
}: ObjectListProps) {
  if (objects.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">None</div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-0.5", comfortable && "gap-1 py-1")}>
      {objects.map((object) => (
        <ObjectItem
          key={object.id}
          object={object}
          isSelected={selectedObjectId === object.id}
          comfortable={comfortable}
          onSelect={() => onSelectObject(object.id)}
          onToggleVisibility={() => onToggleVisibility(object.id)}
          onToggleLock={() => onToggleLock(object.id)}
          onDelete={() => onDeleteObject(object.id)}
        />
      ))}
    </div>
  )
}

function ObjectsTriggerContent({
  objectsCount,
  expanded,
}: {
  objectsCount: number
  expanded: boolean
}) {
  return (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-1">
        <Stack size={14} className="shrink-0 text-zinc-500" aria-hidden />
        <span className="truncate text-[11px] font-medium text-zinc-200">
          Objects
          {objectsCount > 0 ? (
            <span className="text-zinc-500"> · {objectsCount}</span>
          ) : null}
        </span>
      </span>
      {expanded ? (
        <CaretUp size={12} className="shrink-0 text-zinc-500" aria-hidden />
      ) : (
        <CaretDown size={12} className="shrink-0 text-zinc-500" aria-hidden />
      )}
    </>
  )
}

export function ImageEditorLayers({
  className,
  variant = "dropdown",
}: ImageEditorLayersProps) {
  const { state } = useImageEditor()
  const { canvas } = state

  const [objectsOpen, setObjectsOpen] = React.useState(false)
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

  const listProps: ObjectListProps = {
    objects,
    selectedObjectId,
    onSelectObject: handleSelectObject,
    onToggleVisibility: handleToggleVisibility,
    onToggleLock: handleToggleLock,
    onDeleteObject: handleDeleteObject,
  }

  if (variant === "sheet") {
    return (
      <div
        className={cn(
          "flex h-8 w-[10.5rem] shrink-0 items-stretch sm:w-44",
          className
        )}
      >
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex h-8 min-h-8 w-full items-center justify-between gap-1 rounded-lg border border-white/10 bg-zinc-900/90 px-2 py-0 text-left text-zinc-100 backdrop-blur-md hover:bg-white/5"
              aria-label="Open objects list"
            >
              <ObjectsTriggerContent
                objectsCount={objects.length}
                expanded={false}
              />
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[min(85dvh,520px)] gap-0 rounded-t-2xl pb-6"
          >
            <SheetHeader className="pb-2 text-left">
              <SheetTitle>Objects</SheetTitle>
            </SheetHeader>
            <div className="mobile-nav-scrollless max-h-[min(60dvh,400px)] overflow-y-auto pr-1">
              <ObjectList {...listProps} comfortable />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative h-8 w-[10.5rem] shrink-0 sm:w-44",
        className
      )}
    >
      <button
        type="button"
        className="flex h-8 w-full items-center justify-between gap-1 rounded-lg border border-white/10 bg-zinc-900/90 px-2 text-left text-zinc-100 backdrop-blur-md hover:bg-white/5"
        onClick={() => setObjectsOpen((o) => !o)}
        aria-expanded={objectsOpen}
        title={objectsOpen ? "Hide object list" : "Show object list"}
      >
        <ObjectsTriggerContent
          objectsCount={objects.length}
          expanded={objectsOpen}
        />
      </button>

      {objectsOpen && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-40 max-h-48 w-full min-w-[10.5rem] overflow-y-auto rounded-lg border border-white/10 bg-zinc-900/95 p-1 shadow-xl backdrop-blur-md sm:min-w-[11rem]">
          <ObjectList {...listProps} />
        </div>
      )}
    </div>
  )
}

// Object row component
interface ObjectItemProps {
  object: CanvasObjectMeta
  isSelected: boolean
  comfortable?: boolean
  onSelect: () => void
  onToggleVisibility: () => void
  onToggleLock: () => void
  onDelete: () => void
}

function ObjectItem({
  object,
  isSelected,
  comfortable = false,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onDelete,
}: ObjectItemProps) {
  return (
    <div
      className={cn(
        "flex cursor-pointer items-center gap-0.5 rounded-md px-1 transition-colors",
        comfortable ? "min-h-11 py-1.5 px-2" : "py-1",
        isSelected
          ? "bg-primary/20 ring-1 ring-primary/40"
          : "hover:bg-white/5"
      )}
      onClick={onSelect}
    >
      <div className="flex h-5 w-6 shrink-0 items-center justify-center rounded bg-zinc-800">
        <span className="text-[8px] uppercase leading-none tracking-tight text-zinc-500">
          {(object.type || "?").slice(0, 3)}
        </span>
      </div>

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[10px] leading-tight",
          object.visible ? "text-zinc-300" : "text-zinc-600",
          comfortable && "text-xs"
        )}
      >
        {object.name}
      </span>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className={cn(
            "rounded p-1.5 transition-colors",
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
          {object.visible ? <Eye size={14} /> : <EyeSlash size={14} />}
        </button>

        <button
          type="button"
          className={cn(
            "rounded p-1.5 transition-colors",
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
          {object.locked ? <Lock size={14} /> : <LockOpen size={14} />}
        </button>

        <button
          type="button"
          className="rounded p-1.5 text-zinc-600 transition-colors hover:text-red-400"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          title="Delete object"
        >
          <Trash size={14} />
        </button>
      </div>
    </div>
  )
}
