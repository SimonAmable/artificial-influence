"use client"

import * as React from "react"
import { Play, Folder, FolderOpen, CircleNotch } from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"

interface CanvasGroupHeaderProps {
  groupName: string
  onRunGroup?: () => void
  isRunGroupRunning?: boolean
  onUngroup: () => void
  onCreateWorkflow?: () => void
}

export function CanvasGroupHeader({
  groupName,
  onRunGroup,
  isRunGroupRunning = false,
  onUngroup,
  onCreateWorkflow,
}: CanvasGroupHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="nopan nodrag"
    >
      <div className="rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-md shadow-xl px-3 py-2 flex items-center gap-2">
        <Folder className="w-4 h-4 text-zinc-500" weight="duotone" />
        <span className="text-xs text-zinc-400 font-medium">
          {groupName}
        </span>
        
        <div className="w-px h-4 bg-white/10 mx-1" />

        {onRunGroup && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onRunGroup}
            disabled={isRunGroupRunning}
            className="h-7 gap-2 text-xs hover:bg-white/5 hover:text-emerald-400 disabled:opacity-70"
          >
            {isRunGroupRunning ? (
              <CircleNotch className="w-3.5 h-3.5 animate-spin" weight="bold" />
            ) : (
              <Play className="w-3.5 h-3.5" weight="fill" />
            )}
            {isRunGroupRunning ? "Running…" : "Run Group"}
          </Button>
        )}

        {onCreateWorkflow && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onCreateWorkflow}
            className="h-7 gap-2 text-xs hover:bg-white/5 hover:text-blue-400"
          >
            <Folder className="w-3.5 h-3.5" />
            Create Workflow
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={onUngroup}
          className="h-7 gap-2 text-xs hover:bg-white/5 hover:text-orange-400"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Ungroup
        </Button>
      </div>
    </motion.div>
  )
}