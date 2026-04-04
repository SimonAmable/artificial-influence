"use client"

import * as React from "react"
import { NodeProps, NodeResizer } from "@xyflow/react"
import type { GroupNodeData } from "@/lib/canvas/types"
import { applyGroupShellOpacity } from "@/lib/canvas/group-shell-color"
import { useCanvasWorkflowExecution } from "@/components/canvas/canvas-workflow-execution-context"
import { useFlowMultiSelectActive } from "@/hooks/use-flow-multi-select-active"
import { cn } from "@/lib/utils"

export const GroupNodeComponent = React.memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as GroupNodeData
  const { executingGroupId } = useCanvasWorkflowExecution()
  const isWorkflowRunning = executingGroupId === id
  const multiSelectActive = useFlowMultiSelectActive()
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

  const shellBackgroundColor =
    !nodeData.backgroundColor || nodeData.backgroundColor === "#f0f0f0"
      ? "transparent"
      : nodeData.backgroundColor

  const shellFill =
    shellBackgroundColor === "transparent"
      ? "transparent"
      : applyGroupShellOpacity(shellBackgroundColor)

  return (
    <>
      {/* Resizer - only visible when selected */}
      <NodeResizer
        isVisible={selected && !multiSelectActive}
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
            className="text-base font-medium text-zinc-400 uppercase tracking-wider bg-transparent border border-zinc-500/40 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-zinc-500/40"
          />
        ) : (
          <span 
            className={cn(
              "text-base font-medium text-zinc-400 uppercase tracking-wider",
              selected && "cursor-pointer hover:text-zinc-300 transition-colors"
            )}
          >
            {labelValue}
          </span>
        )}
      </div>

      <div
        className={cn(
          "w-full h-full min-h-[120px] rounded-none border relative overflow-hidden transition-[box-shadow,border-color]",
          selected ? "border-zinc-500/45" : "border-white/10",
          isWorkflowRunning && "ring-2 ring-emerald-400/35 border-emerald-500/25"
        )}
        style={{ backgroundColor: shellFill }}
      >
        {isWorkflowRunning ? (
          <>
            <div
              className="absolute inset-y-0 left-0 z-10 bg-gradient-to-r from-zinc-800 to-zinc-700 rounded-none"
              style={{
                width: "0%",
                animation: "groupWorkflowFill 24s linear infinite",
                boxShadow: "2px 0 8px 0 rgba(255, 255, 255, 0.35)",
              }}
            />
            <div className="absolute inset-0 z-[11] bg-gradient-to-br from-zinc-800/30 via-transparent to-zinc-900/35 pointer-events-none rounded-none" />
            <style jsx>{`
              @keyframes groupWorkflowFill {
                0% {
                  width: 0%;
                }
                100% {
                  width: 100%;
                }
              }
            `}</style>
          </>
        ) : null}
      </div>
    </>
  )
})

GroupNodeComponent.displayName = 'GroupNodeComponent'
