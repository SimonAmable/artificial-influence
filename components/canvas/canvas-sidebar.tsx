"use client"

import * as React from "react"
import {
  Plus,
  X,
  Shapes,
  ClockCounterClockwise,
  Stack,
  SpeakerHigh,
  type IconProps,
} from "@phosphor-icons/react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import type { CanvasNodeType, CanvasNodeData } from "@/lib/canvas/types"
import type { Workflow } from "@/lib/workflows/database-server"
import { createClient } from "@/lib/supabase/client"
import { WorkflowsMenu } from "@/components/canvas/workflows-menu"
import { AddNodesMenu } from "@/components/canvas/add-nodes-menu"
import Image from "next/image"

interface Generation {
  id: string
  user_id: string
  prompt: string | null
  supabase_storage_path: string
  type: 'image' | 'video' | 'audio'
  model: string | null
  created_at: string
  url: string
}

interface CanvasSidebarProps {
  onAddNode: (type: CanvasNodeType, initialData?: Partial<CanvasNodeData>, screenPosition?: { x: number; y: number }) => void
  onInstantiateWorkflow?: (workflow: Workflow) => void
  onEditWorkflow?: (workflow: Workflow) => void
}

type MenuType = "add-nodes" | "workflows" | "assets" | "history" | null

type IconComponent = React.ComponentType<IconProps>

function SidebarButton({
  icon: Icon,
  isActive,
  onClick,
  onMouseEnter,
  className,
}: {
  icon: IconComponent
  isActive?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
  className?: string
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        "w-10 h-10 flex items-center justify-center rounded-full transition-colors",
        isActive ? "text-white" : "text-zinc-400 hover:text-white hover:bg-white/10",
        className
      )}
    >
      <Icon size={24} weight={isActive ? "fill" : "bold"} />
    </motion.button>
  )
}

export function CanvasSidebar({ onAddNode, onInstantiateWorkflow, onEditWorkflow }: CanvasSidebarProps) {
  const [activeMenu, setActiveMenu] = React.useState<MenuType>(null)
  const [generations, setGenerations] = React.useState<Generation[]>([])
  const [loadingGenerations, setLoadingGenerations] = React.useState(false)
  const [hasMore, setHasMore] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const addMenuCloseTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Handle clicking on a history item to add it as a node
  const handleImageClick = React.useCallback((gen: Generation) => {
    // Currently only support images
    if (gen.type === 'image') {
      // Add upload node with the image data pre-populated
      onAddNode('upload', {
        fileUrl: gen.url,
        fileType: 'image',
        fileName: gen.prompt ? `${gen.prompt.slice(0, 30)}...` : 'Generated Image',
      })
      setActiveMenu(null) // Close the history sidebar
    }
  }, [onAddNode])

  const fetchGenerations = React.useCallback(async (pageNum: number) => {
    setLoadingGenerations(prev => {
      if (prev) return prev // Already loading, skip
      return true
    })
    
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setLoadingGenerations(false)
        return
      }

      const limit = 12
      const offset = (pageNum - 1) * limit

      const response = await fetch(`/api/generations?limit=${limit}&offset=${offset}`)
      if (response.ok) {
        const data = await response.json()
        const newGenerations = data.generations || []
        
        if (pageNum === 1) {
          setGenerations(newGenerations)
        } else {
          setGenerations(prev => [...prev, ...newGenerations])
        }
        
        setHasMore(newGenerations.length === limit)
      }
    } catch (error) {
      console.error('Error fetching generations:', error)
    } finally {
      setLoadingGenerations(false)
    }
  }, []) // Empty deps - function never changes

  // Fetch generations when history menu opens
  React.useEffect(() => {
    if (activeMenu === 'history') {
      setGenerations([])
      setPage(1)
      setHasMore(true)
      fetchGenerations(1)
    }
  }, [activeMenu, fetchGenerations])

  const handleScroll = React.useCallback(() => {
    if (!scrollContainerRef.current || !hasMore) return
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    
    // Load more when scrolled to within 100px of bottom
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      setPage(prev => {
        const nextPage = prev + 1
        fetchGenerations(nextPage)
        return nextPage
      })
    }
  }, [hasMore, fetchGenerations])

  // Group generations by date
  const groupedGenerations = React.useMemo(() => {
    const groups: { [date: string]: Generation[] } = {}
    
    generations.forEach((gen) => {
      const date = new Date(gen.created_at)
      const dateKey = date.toISOString().split('T')[0]
      
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(gen)
    })
    
    return groups
  }, [generations])

  const formatDateHeader = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const genDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    
    if (genDate.getTime() === today.getTime()) {
      return 'Today'
    } else if (genDate.getTime() === yesterday.getTime()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      })
    }
  }

  // Handle clicking outside to close menus
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const openAddMenu = React.useCallback(() => {
    if (addMenuCloseTimeout.current) {
      clearTimeout(addMenuCloseTimeout.current)
      addMenuCloseTimeout.current = null
    }
    setActiveMenu("add-nodes")
  }, [])

  const scheduleCloseAddMenu = React.useCallback(() => {
    if (addMenuCloseTimeout.current) {
      clearTimeout(addMenuCloseTimeout.current)
    }
    addMenuCloseTimeout.current = setTimeout(() => {
      setActiveMenu((current) => (current === "add-nodes" ? null : current))
    }, 220)
  }, [])

  React.useEffect(() => {
    return () => {
      if (addMenuCloseTimeout.current) {
        clearTimeout(addMenuCloseTimeout.current)
      }
    }
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      {/* Primary Sidebar Capsule */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          "w-14 rounded-full border  border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl",
          "py-2 px-7 flex flex-col items-center gap-6"
        )}
      >
        {/* Toggle Plus Button */}
        <div 
          className="relative px-2"
          onMouseEnter={openAddMenu}
          onMouseLeave={scheduleCloseAddMenu}
        >
          <motion.button
            onClick={() => {
              if (activeMenu === "add-nodes") {
                setActiveMenu(null)
              } else {
                openAddMenu()
              }
            }}
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300",
              activeMenu === "add-nodes" 
                ? "bg-zinc-700 text-white rotate-45" 
                : "bg-white text-black hover:rotate-45"
            )}
          >
            {activeMenu === "add-nodes" ? <X size={20} weight="bold" /> : <Plus size={20} weight="bold" />}
          </motion.button>
        </div>

        {/* Navigation Items */}
        <div className="flex flex-col items-center gap-4">
          <SidebarButton 
            icon={Stack} 
            isActive={activeMenu === "workflows"}
            onClick={() => setActiveMenu(activeMenu === "workflows" ? null : "workflows")}
          />
          <SidebarButton 
            icon={Shapes} 
            isActive={activeMenu === "assets"}
            onClick={() => setActiveMenu(activeMenu === "assets" ? null : "assets")}
          />
          <SidebarButton 
            icon={ClockCounterClockwise} 
            isActive={activeMenu === "history"}
            onClick={() => setActiveMenu(activeMenu === "history" ? null : "history")}
          />
        </div>
      </motion.div>

      {/* Flyout Menus */}
      <AnimatePresence mode="wait">
        {activeMenu === "add-nodes" && (
          <motion.div
            key="add-nodes"
            initial={{ opacity: 0, x: -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onMouseEnter={openAddMenu}
            onMouseLeave={scheduleCloseAddMenu}
            className="absolute left-[72px] top-0 w-64 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl"
          >
            <AddNodesMenu
              onAddNode={(type, initialData) => onAddNode(type, initialData)}
              onClose={() => setActiveMenu(null)}
            />
          </motion.div>
        )}

        {activeMenu === "workflows" && (
          <WorkflowsMenu
            key="workflows"
            isOpen={activeMenu === "workflows"}
            onInstantiate={onInstantiateWorkflow}
            onEdit={onEditWorkflow}
          />
        )}

        {activeMenu === "assets" && (
          <motion.div
            key="assets"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="absolute left-[72px] top-0 w-80 h-[400px] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl"
          >
            <h3 className="text-sm font-medium text-white mb-4">Assets</h3>
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
              <Shapes size={40} weight="thin" />
              <p className="text-xs">No assets available yet</p>
            </div>
          </motion.div>
        )}

        {activeMenu === "history" && (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="absolute left-[72px] top-0 w-80 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: '500px' }}
          >
            {/* Fullscreen button - commented out for future implementation
            <div className="flex items-center justify-between p-4 pb-3 border-b border-white/10">
              <h3 className="text-sm font-medium text-white">History</h3>
              <button
                onClick={() => {}}
                className="text-zinc-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
                title="Expand to fullscreen"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              </button>
            </div>
            */}
            <h3 className="text-sm font-medium text-white p-4 pb-3 border-b border-white/10">History</h3>
            
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 pt-3"
            >
              {generations.length === 0 && !loadingGenerations ? (
                <div className="flex flex-col items-center justify-center h-32 text-zinc-500 gap-2">
                  <ClockCounterClockwise size={40} weight="thin" />
                  <p className="text-xs">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedGenerations)
                    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
                    .map(([date, dateGenerations]) => (
                      <div key={date}>
                        <h4 className="text-xs font-medium text-zinc-400 mb-2">
                          {formatDateHeader(date)}
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {dateGenerations.map((gen) => (
                            <div
                              key={gen.id}
                              onClick={() => handleImageClick(gen)}
                              className="relative aspect-square rounded-lg overflow-hidden bg-zinc-800 hover:ring-2 hover:ring-white/20 transition-all cursor-pointer group"
                            >
                              {gen.type === 'image' ? (
                                <Image
                                  src={gen.url}
                                  alt={gen.prompt || 'Generated image'}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : gen.type === 'video' ? (
                                <video
                                  src={gen.url}
                                  className="w-full h-full object-cover"
                                  preload="metadata"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                  <SpeakerHigh size={32} weight="thin" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <div className="text-white text-xs px-2 py-1 bg-black/60 rounded backdrop-blur-sm">
                                  {gen.type}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  
                  {loadingGenerations && (
                    <div className="flex justify-center py-4">
                      <p className="text-xs text-zinc-500">Loading more...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
