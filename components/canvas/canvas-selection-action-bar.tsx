"use client"

import * as React from "react"
import { Folder, Copy, Trash, FloppyDisk, FolderOpen } from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"

interface CanvasSelectionActionBarProps {
  selectedCount: number
  selectedGroupId?: string | null
  onGroup: () => void
  onUngroup?: () => void
  onDuplicate: () => void
  onDelete: () => void
  onSaveWorkflow?: () => void
}

export function CanvasSelectionActionBar({
  selectedCount,
  selectedGroupId,
  onGroup,
  onUngroup,
  onDuplicate,
  onDelete,
  onSaveWorkflow,
}: CanvasSelectionActionBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="nopan nodrag"
    >
      <div className="rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-md shadow-xl px-3 py-2 flex items-center gap-2">
        <span className="text-xs text-zinc-400 mr-2">
          {selectedCount} selected
        </span>
        
        {/* Show Ungroup button when a group is selected */}
        {selectedGroupId && onUngroup ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={onUngroup}
            className="h-8 gap-2 text-xs hover:bg-white/5 hover:text-orange-400"
          >
            <FolderOpen className="w-4 h-4" />
            Ungroup
          </Button>
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
