"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Stack, Pencil, Trash, Globe } from "@phosphor-icons/react"
import Image from "next/image"
import type { Workflow } from "@/lib/workflows/database-server"
import { toast } from "sonner"

interface WorkflowsMenuProps {
  onInstantiate?: (workflow: Workflow) => void
  onEdit?: (workflow: Workflow) => void
  isOpen: boolean
}

export function WorkflowsMenu({ onInstantiate, onEdit, isOpen }: WorkflowsMenuProps) {
  const [workflows, setWorkflows] = React.useState<Workflow[]>([])
  const [loading, setLoading] = React.useState(false)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

  // Fetch workflows when menu opens
  React.useEffect(() => {
    if (isOpen) {
      fetchWorkflows()
    }
  }, [isOpen])

  const fetchWorkflows = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/workflows")
      if (response.ok) {
        const data = await response.json()
        setWorkflows(data)
      } else {
        toast.error("Failed to load workflows")
      }
    } catch (error) {
      console.error("Error fetching workflows:", error)
      toast.error("Failed to load workflows")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (workflowId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    
    if (!confirm("Are you sure you want to delete this workflow?")) {
      return
    }

    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Workflow deleted")
        setWorkflows(prev => prev.filter(w => w.id !== workflowId))
      } else {
        toast.error("Failed to delete workflow")
      }
    } catch (error) {
      console.error("Error deleting workflow:", error)
      toast.error("Failed to delete workflow")
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="absolute left-[72px] top-0 w-80 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col"
      style={{ maxHeight: '500px' }}
    >
      <h3 className="text-sm font-medium text-white p-4 pb-3 border-b border-white/10">
        Saved Workflows
      </h3>
      
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 pt-3"
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <p className="text-xs text-zinc-500">Loading workflows...</p>
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-zinc-500 gap-2">
            <Stack size={40} weight="thin" />
            <p className="text-xs text-center px-4">
              No saved workflows yet.<br/>
              Select a group and click &quot;Save Workflow&quot; to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                onClick={() => onInstantiate?.(workflow)}
                className="relative group cursor-pointer"
              >
                <div className="aspect-square rounded-lg overflow-hidden bg-zinc-800 hover:ring-2 hover:ring-purple-400/50 transition-all">
                  {workflow.thumbnail_url ? (
                    <Image
                      src={workflow.thumbnail_url}
                      alt={workflow.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400">
                      <Stack size={32} weight="thin" />
                    </div>
                  )}
                  
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex flex-col items-center justify-center opacity-0 group-hover:opacity-100">
                    <p className="text-white text-xs font-medium px-2 text-center">
                      {workflow.name}
                    </p>
                    {workflow.is_public && (
                      <div className="mt-1 flex items-center gap-1 text-emerald-400 text-[10px]">
                        <Globe size={12} weight="bold" />
                        <span>Public</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons - visible on hover */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit?.(workflow)
                    }}
                    className="w-6 h-6 rounded-md bg-black/60 backdrop-blur-sm hover:bg-black/80 transition-colors flex items-center justify-center text-white"
                    title="Edit workflow"
                  >
                    <Pencil size={14} weight="bold" />
                  </button>
                  {workflow.user_id && (
                    <button
                      onClick={(e) => handleDelete(workflow.id, e)}
                      className="w-6 h-6 rounded-md bg-black/60 backdrop-blur-sm hover:bg-red-500/90 transition-colors flex items-center justify-center text-white"
                      title="Delete workflow"
                    >
                      <Trash size={14} weight="bold" />
                    </button>
                  )}
                </div>

                {/* Workflow name below thumbnail */}
                <p className="mt-1.5 text-xs text-zinc-400 truncate">
                  {workflow.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
