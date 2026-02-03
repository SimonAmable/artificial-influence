"use client"

import * as React from "react"
import { NodeProps, NodeResizer } from "@xyflow/react"
import type { GroupNodeData } from "@/lib/canvas/types"
import { cn } from "@/lib/utils"

export const GroupNodeComponent = React.memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as GroupNodeData
  const [isEditingLabel, setIsEditingLabel] = React.useState(false)
  const [labelValue, setLabelValue] = React.useState(nodeData.label)
  const labelInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (isEditingLabel && labelInputRef.current) {
      labelInputRef.current.focus()
      labelInputRef.current.select()
    }
  }, [isEditingLabel])

  const handleLabelClick = () => {
    if (selected) {
      setIsEditingLabel(true)
    }
  }

  const handleLabelBlur = () => {
    setIsEditingLabel(false)
    if (labelValue.trim()) {
      nodeData.onDataChange?.(id, { label: labelValue.trim() })
    } else {
      setLabelValue(nodeData.label)
    }
  }

  const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleLabelBlur()
    } else if (e.key === "Escape") {
      setIsEditingLabel(false)
      setLabelValue(nodeData.label)
    }
  }

  return (
    <>
      {/* Resizer - only visible when selected */}
      <NodeResizer
        isVisible={selected}
        minWidth={250}
        minHeight={200}
        lineClassName="border-zinc-500/40"
        handleClassName="w-2 h-2 bg-zinc-600 border border-zinc-500 rounded-sm"
      />

      {/* Editable title above top left */}
      <div 
        className="absolute bottom-full mb-1.5 left-0 nopan nodrag"
        onClick={handleLabelClick}
      >
        {isEditingLabel ? (
          <input
            ref={labelInputRef}
            type="text"
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            onBlur={handleLabelBlur}
            onKeyDown={handleLabelKeyDown}
            className="text-xs font-medium text-zinc-400 uppercase tracking-wider bg-transparent border border-zinc-500/40 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-zinc-500/40"
          />
        ) : (
          <span 
            className={cn(
              "text-xs font-medium text-zinc-400 uppercase tracking-wider",
              selected && "cursor-pointer hover:text-zinc-300 transition-colors"
            )}
          >
            {labelValue}
          </span>
        )}
      </div>

      {/* Simple group container with natural low opacity background */}
      <div
        
        
      />
    </>
  )
})

GroupNodeComponent.displayName = 'GroupNodeComponent'
