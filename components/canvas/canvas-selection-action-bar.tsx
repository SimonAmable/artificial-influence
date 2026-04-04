"use client"

import * as React from "react"
import {
  Folder,
  Copy,
  Trash,
  FloppyDisk,
  FolderOpen,
  Play,
  CircleNotch,
} from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { applyGroupShellOpacity } from "@/lib/canvas/group-shell-color"

/** Matches group-node: sentinel clears shell fill to transparent. */
const GROUP_TRANSPARENT_SENTINEL = "#f0f0f0"

function cssColorToHexForInput(css: string | null | undefined): string {
  if (!css || css === GROUP_TRANSPARENT_SENTINEL) return "#3f3f46"
  const trimmed = css.trim()
  if (trimmed.startsWith("#")) {
    const h = trimmed.slice(1)
    if (h.length === 3) {
      return (
        "#" +
        h
          .split("")
          .map((c) => c + c)
          .join("")
      )
    }
    if (h.length >= 6) return "#" + h.slice(0, 6).toLowerCase()
  }
  const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (rgb) {
    const toHex = (n: number) =>
      Math.min(255, Math.max(0, n)).toString(16).padStart(2, "0")
    return `#${toHex(Number(rgb[1]))}${toHex(Number(rgb[2]))}${toHex(Number(rgb[3]))}`
  }
  return "#3f3f46"
}

function groupShellPreview(css: string | null | undefined): string | undefined {
  if (!css || css === GROUP_TRANSPARENT_SENTINEL) return undefined
  return css
}

function GroupBackgroundColorPicker({
  value,
  onChange,
}: {
  value: string | null | undefined
  onChange: (color: string) => void
}) {
  const hex = cssColorToHexForInput(value)
  const preview = groupShellPreview(value)

  return (
    <div className="mr-1.5" onPointerDown={(e) => e.stopPropagation()}>
      <label
        className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-white/25 bg-[repeating-conic-gradient(#3f3f46_0%_25%,#27272a_0%_50%)_50%_50%/6px_6px] shadow-md"
        title="Group color"
      >
        {preview ? (
          <span
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: applyGroupShellOpacity(preview) }}
          />
        ) : null}
        <input
          type="color"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 rounded-full"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Group background color"
        />
      </label>
    </div>
  )
}

interface CanvasSelectionActionBarProps {
  selectedCount: number
  selectedGroupId?: string | null
  /** Current group shell color (see GroupNodeData.backgroundColor). */
  groupBackgroundColor?: string | null
  onGroupBackgroundColorChange?: (color: string) => void
  onGroup: () => void
  onRunGroup?: () => void
  /** True while this group's workflow is executing (spinner on Run Group). */
  isRunGroupRunning?: boolean
  onUngroup?: () => void
  onDuplicate: () => void
  onDelete: () => void
  onSaveWorkflow?: () => void
}

export function CanvasSelectionActionBar({
  selectedCount,
  selectedGroupId,
  groupBackgroundColor,
  onGroupBackgroundColorChange,
  onGroup,
  onRunGroup,
  isRunGroupRunning = false,
  onUngroup,
  onDuplicate,
  onDelete,
  onSaveWorkflow,
}: CanvasSelectionActionBarProps) {
  const showGroupColor =
    !!selectedGroupId && typeof onGroupBackgroundColorChange === "function"

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="nopan nodrag"
    >
      <div className="rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-md shadow-xl px-3 py-2 flex items-center gap-2">
        {showGroupColor ? (
          <GroupBackgroundColorPicker
            value={groupBackgroundColor}
            onChange={onGroupBackgroundColorChange}
          />
        ) : (
          <span className="text-xs text-zinc-400 mr-2">
            {selectedCount} selected
          </span>
        )}
        
        {/* Show Ungroup button when a group is selected */}
        {selectedGroupId && onUngroup ? (
          <>
            {onRunGroup && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onRunGroup}
                disabled={isRunGroupRunning}
                className="h-8 gap-2 text-xs hover:bg-white/5 hover:text-emerald-400 disabled:opacity-70"
              >
                {isRunGroupRunning ? (
                  <CircleNotch className="w-4 h-4 animate-spin" weight="bold" />
                ) : (
                  <Play className="w-4 h-4" weight="fill" />
                )}
                {isRunGroupRunning ? "Running…" : "Run Group"}
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={onUngroup}
              className="h-8 gap-2 text-xs hover:bg-white/5 hover:text-orange-400"
            >
              <FolderOpen className="w-4 h-4" />
              Ungroup
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={onGroup}
            className="h-8 gap-2 text-xs hover:bg-white/5 hover:text-emerald-400"
          >
            <Folder className="w-4 h-4" />
            Group
          </Button>
        )}

        {/* Show Save Workflow button only when a single group is selected */}
        {selectedGroupId && onSaveWorkflow && (
          <>
            <div className="w-px h-4 bg-white/10" />
            <Button
              size="sm"
              variant="ghost"
              onClick={onSaveWorkflow}
              className="h-8 gap-2 text-xs hover:bg-white/5 hover:text-purple-400"
            >
              <FloppyDisk className="w-4 h-4" />
              Save Workflow
            </Button>
          </>
        )}

        <div className="w-px h-4 bg-white/10" />

        <Button
          size="sm"
          variant="ghost"
          onClick={onDuplicate}
          className="h-8 gap-2 text-xs hover:bg-white/5 hover:text-blue-400"
        >
          <Copy className="w-4 h-4" />
          Duplicate
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="h-8 gap-2 text-xs hover:bg-white/5 hover:text-red-400"
        >
          <Trash className="w-4 h-4" />
          Delete
        </Button>
      </div>
    </motion.div>
  )
}
