"use client"

import * as React from "react"
import { Node } from "@xyflow/react"
import { Copy, Clipboard, CopyPlus, Trash2, Group, Ungroup } from "lucide-react"
import { cn } from "@/lib/utils"

interface CanvasContextMenuProps {
  position: { x: number; y: number } | null
  selectedNodes: Node[]
  clickedNode: Node | null
  hasClipboard: boolean
  onCopy: () => void
  onPaste: (position: { x: number; y: number }) => void
  onDuplicate: () => void
  onDelete: () => void
  onGroup: () => void
  onUngroup: () => void
  onClose: () => void
}

export function CanvasContextMenu({
  position,
  selectedNodes,
  clickedNode,
  hasClipboard,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  onClose,
}: CanvasContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null)

  const isGroupNode = clickedNode?.type === "group"
  const hasMultipleSelected = selectedNodes.length > 1
  // Show node actions if we have selections OR if a node was clicked (will be auto-selected)
  const hasSelection = selectedNodes.length > 0 || clickedNode !== null

  // Close menu when clicking outside
  React.useEffect(() => {
    if (!position) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as HTMLElement)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [position, onClose])

  if (!position) return null

  const handleAction = (action: () => void) => {
    action()
    onClose()
  }

  const handlePaste = () => {
    onPaste(position)
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80"
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {/* Node selection actions */}
      {hasSelection && (
        <>
          <button
            onClick={() => handleAction(onCopy)}
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy
            <span className="ml-auto text-xs text-muted-foreground">Ctrl+C</span>
          </button>
          <button
            onClick={() => handleAction(onDuplicate)}
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          >
            <CopyPlus className="mr-2 h-4 w-4" />
            Duplicate
            <span className="ml-auto text-xs text-muted-foreground">Ctrl+D</span>
          </button>
          <button
            onClick={() => handleAction(onDelete)}
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-destructive hover:text-destructive-foreground focus:bg-destructive focus:text-destructive-foreground text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
            <span className="ml-auto text-xs text-muted-foreground">Del</span>
          </button>
          <div className="my-1 h-px bg-border" />
        </>
      )}

      {/* Group/Ungroup actions */}
      {hasMultipleSelected && !isGroupNode && (
        <>
          <button
            onClick={() => handleAction(onGroup)}
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          >
            <Group className="mr-2 h-4 w-4" />
            Group Selection
          </button>
          <div className="my-1 h-px bg-border" />
        </>
      )}

      {isGroupNode && (
        <>
          <button
            onClick={() => handleAction(onUngroup)}
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          >
            <Ungroup className="mr-2 h-4 w-4" />
            Ungroup
          </button>
          <div className="my-1 h-px bg-border" />
        </>
      )}

      {/* Paste action (always available if clipboard has data) */}
      {hasClipboard && (
        <button
          onClick={handlePaste}
          className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
        >
          <Clipboard className="mr-2 h-4 w-4" />
          Paste
          <span className="ml-auto text-xs text-muted-foreground">Ctrl+V</span>
        </button>
      )}

      {/* Show message when no actions available */}
      {!hasSelection && !hasClipboard && (
        <div className="relative flex w-full select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none text-muted-foreground cursor-default">
          No actions available
        </div>
      )}
    </div>
  )
}
