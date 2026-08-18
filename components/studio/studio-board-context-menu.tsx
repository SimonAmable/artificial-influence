"use client"

import * as React from "react"
import {
  ArrowsClockwise,
  ArrowsOutSimple,
  Copy,
  DownloadSimple,
  FolderOpen,
  PencilSimple,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import type { StudioTile } from "@/lib/studio/types"

export type StudioBoardMenuState =
  | { type: "board"; screenX: number; screenY: number; world: { x: number; y: number } }
  | { type: "tile"; screenX: number; screenY: number; tile: StudioTile }

interface StudioBoardContextMenuProps {
  menu: StudioBoardMenuState | null
  onClose: () => void
  onUpload: () => void
  onAddFromLibrary: () => void
  onPaste: () => void
  onOpenTile?: (tile: StudioTile) => void
  onEditTile?: (tile: StudioTile) => void
  onRecreateTile?: (tile: StudioTile) => void
  onCopyTile?: (tile: StudioTile) => void
  onDownloadTile?: (tile: StudioTile) => void
  onDeleteTile?: (tile: StudioTile) => void
}

function MenuButton({
  label,
  shortcut,
  destructive,
  disabled,
  onClick,
  children,
}: {
  label: string
  shortcut?: string
  destructive?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none",
        "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
        destructive &&
          "text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive",
        disabled && "pointer-events-none opacity-50",
      )}
      onClick={onClick}
    >
      {children}
      {label}
      {shortcut ? (
        <span className="ml-auto text-xs tracking-widest text-muted-foreground">{shortcut}</span>
      ) : null}
    </button>
  )
}

export function StudioBoardContextMenu({
  menu,
  onClose,
  onUpload,
  onAddFromLibrary,
  onPaste,
  onOpenTile,
  onEditTile,
  onRecreateTile,
  onCopyTile,
  onDownloadTile,
  onDeleteTile,
}: StudioBoardContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!menu) return

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [menu, onClose])

  if (!menu) return null

  const run = (action: () => void) => {
    action()
    onClose()
  }

  const tile = menu.type === "tile" ? menu.tile : null
  const canAct = Boolean(tile?.url && tile.status === "completed")
  const pasteShortcut =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘V" : "Ctrl+V"

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-48 origin-top-left"
      style={{ left: menu.screenX, top: menu.screenY }}
    >
      <div className="overflow-hidden rounded-2xl bg-popover p-1 text-popover-foreground shadow-2xl ring-1 ring-foreground/5">
        {menu.type === "board" ? (
          <>
            <MenuButton label="Upload" onClick={() => run(onUpload)}>
              <UploadSimple className="size-4" />
            </MenuButton>
            <MenuButton label="From library" onClick={() => run(onAddFromLibrary)}>
              <FolderOpen className="size-4" />
            </MenuButton>
            <MenuButton label="Paste here" shortcut={pasteShortcut} onClick={() => run(onPaste)}>
              <Copy className="size-4" />
            </MenuButton>
          </>
        ) : tile ? (
          <>
            <MenuButton
              label="Full screen"
              disabled={!canAct}
              onClick={() => canAct && onOpenTile && run(() => onOpenTile(tile))}
            >
              <ArrowsOutSimple className="size-4" />
            </MenuButton>
            {tile.kind === "image" ? (
              <MenuButton
                label="Edit image"
                disabled={!canAct}
                onClick={() => canAct && onEditTile && run(() => onEditTile(tile))}
              >
                <PencilSimple className="size-4" />
              </MenuButton>
            ) : null}
            <MenuButton
              label="Recreate"
              disabled={!canAct}
              onClick={() => canAct && onRecreateTile && run(() => onRecreateTile(tile))}
            >
              <ArrowsClockwise className="size-4" />
            </MenuButton>
            <MenuButton
              label={tile.kind === "video" ? "Copy video" : "Copy image"}
              disabled={!canAct}
              onClick={() => canAct && onCopyTile && run(() => onCopyTile(tile))}
            >
              <Copy className="size-4" />
            </MenuButton>
            <MenuButton
              label="Download"
              disabled={!canAct}
              onClick={() => canAct && onDownloadTile && run(() => onDownloadTile(tile))}
            >
              <DownloadSimple className="size-4" />
            </MenuButton>
            <div className="bg-border/50 my-1 h-px" />
            <MenuButton
              label="Delete"
              destructive
              onClick={() => onDeleteTile && run(() => onDeleteTile(tile))}
            >
              <Trash className="size-4" />
            </MenuButton>
          </>
        ) : null}
      </div>
    </div>
  )
}
