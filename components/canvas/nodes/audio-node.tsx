"use client"

import * as React from "react"
import { Handle, Position, NodeToolbar, type NodeProps, useStore } from "@xyflow/react"
import {
  SpeakerHigh,
  CircleNotch,
  Play,
  ArrowClockwise,
  ArrowsOut,
  DownloadSimple,
  Plus,
  X,
  PaperPlaneTilt,
} from "@phosphor-icons/react"
import { AnimatePresence, motion } from "framer-motion"
import type { AudioNodeData } from "@/lib/canvas/types"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"

const hintSuggestions = [
  { label: "Text to Speech" },
  { label: "Add voice narration" },
]

export const AudioNodeComponent = React.memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as AudioNodeData
  const { isConnecting, connectingFromId } = useStore((state) => ({
    isConnecting: state.connection.inProgress,
    connectingFromId: state.connection.fromHandle?.nodeId,
  }))
  const [isHovered, setIsHovered] = React.useState(false)
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [title, setTitle] = React.useState(nodeData.label || "Audio")
  const titleInputRef = React.useRef<HTMLInputElement>(null)
  const [isFullscreenOpen, setIsFullscreenOpen] = React.useState(false)

  React.useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  const handleTitleClick = () => {
    if (selected) {
      setIsEditingTitle(true)
    }
  }

  const handleTitleBlur = () => {
    setIsEditingTitle(false)
    if (title.trim()) {
      nodeData.onDataChange?.(id, { label: title.trim() })
    } else {
      setTitle(nodeData.label || "Audio")
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleTitleBlur()
    } else if (e.key === "Escape") {
      setIsEditingTitle(false)
      setTitle(nodeData.label || "Audio")
    }
  }

  const handleDownload = async () => {
    if (!nodeData.generatedAudioUrl) return

    try {
      const response = await fetch(nodeData.generatedAudioUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `${title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.mp3`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch (error) {
      console.error('Error downloading audio:', error)
    }
  }

  const handleSendToChat = () => {
    if (!nodeData.generatedAudioUrl) return
    
    const event = new CustomEvent('chat-add-asset', {
      detail: { url: nodeData.generatedAudioUrl, type: 'audio' }
    })
    window.dispatchEvent(event)
    
    const openChatEvent = new CustomEvent('chat-open')
    window.dispatchEvent(openChatEvent)
  }

  const handleFullscreen = () => {
    if (nodeData.generatedAudioUrl) {
      setIsFullscreenOpen(true)
    }
  }

  const handleGenerate = async () => {
    if (!nodeData.text.trim()) {
      nodeData.onDataChange?.(id, { error: "Enter text to generate audio" })
      return
    }

    nodeData.onDataChange?.(id, { isGenerating: true, error: null })

    try {
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: nodeData.text.trim(),
          voice: nodeData.voice,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || err.message || "Failed to generate audio")
      }

      const result = await response.json()
      const audioUrl = result.audio?.url || result.url
      if (!audioUrl) throw new Error("No audio URL received")

      nodeData.onDataChange?.(id, {
        generatedAudioUrl: audioUrl,
        isGenerating: false,
        error: null,
      })
    } catch (err) {
      nodeData.onDataChange?.(id, {
        isGenerating: false,
        error: err instanceof Error ? err.message : "Generation failed",
      })
    }
  }

  const hasContent = !!nodeData.generatedAudioUrl

  return (
    <>
      {/* Floating toolbar using NodeToolbar */}
      <NodeToolbar
        isVisible={selected && hasContent}
        position={Position.Top}
        offset={35}
      >
        <div className="rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-md shadow-xl px-2 py-2 flex flex-nowrap items-center gap-2 overflow-x-auto nopan nodrag">
          <ToolbarIconButton icon={PaperPlaneTilt} onClick={handleSendToChat} label="Send to AI Chat" />
          <div className="w-px h-5 bg-white/10" />
          
          {/* Voice selector */}
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider px-1">
            Voice
          </label>
          <Select
            value={nodeData.voice || "alloy"}
            onValueChange={(value) => nodeData.onDataChange?.(id, { voice: value })}
          >
            <SelectTrigger className="h-7 text-xs w-fit min-w-[100px] bg-zinc-800/80 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alloy">Alloy</SelectItem>
              <SelectItem value="echo">Echo</SelectItem>
              <SelectItem value="fable">Fable</SelectItem>
              <SelectItem value="onyx">Onyx</SelectItem>
              <SelectItem value="nova">Nova</SelectItem>
              <SelectItem value="shimmer">Shimmer</SelectItem>
            </SelectContent>
          </Select>

          <div className="w-px h-5 bg-white/10" />

          <ToolbarIconButton icon={DownloadSimple} onClick={handleDownload} label="Download" />
          <ToolbarIconButton icon={ArrowsOut} onClick={handleFullscreen} label="Fullscreen" />
        </div>
      </NodeToolbar>

      {/* Editable title above top left of card */}
      <div 
        className="absolute bottom-full mb-1.5 left-0 nopan nodrag"
        onClick={handleTitleClick}
      >
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            className="text-xs font-medium text-orange-400 uppercase tracking-wider bg-transparent border border-orange-500/40 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-orange-500/40"
          />
        ) : (
          <span 
            className={cn(
              "text-xs font-medium text-orange-400 uppercase tracking-wider",
              selected && "cursor-pointer hover:text-orange-300 transition-colors"
            )}
          >
            {title}
          </span>
        )}
      </div>

      {/* Wrapper to allow handles to overflow */}
      <div 
        className={cn(
          "relative w-[280px] h-[280px]",
          isConnecting && connectingFromId !== id && "easy-connect-glow"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Handle
          id="input"
          type="target"
          position={Position.Left}
          isConnectableStart={false}
          className="easy-connect-target"
        />
        {isConnecting && connectingFromId !== id && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/20 text-[10px] font-semibold uppercase tracking-wider text-white/80">
            Drop here
          </div>
        )}
        <div
          className={cn(
            "relative transition-all duration-200 w-full h-full",
            hasContent
              ? "rounded-lg overflow-hidden"
              : "rounded-xl border bg-zinc-900 shadow-lg flex flex-col",
            !hasContent && selected
              ? "border-orange-500/40 ring-1 ring-orange-500/20"
              : !hasContent && "border-white/10 hover:border-white/20",
            hasContent && selected && "ring-2 ring-orange-500/40"
          )}
        >

          {/* Content area: hints OR generated preview */}
          {hasContent ? (
            <div className="relative w-full h-full flex items-center justify-center bg-zinc-900 rounded-lg p-4">
              <audio
                src={nodeData.generatedAudioUrl!}
                controls
                className="w-full"
              />
            </div>
          ) : (
            <div className="px-3 py-3">
              <div className="py-2 space-y-1.5">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Try to:</p>
                {hintSuggestions.map((hint) => (
                  <div key={hint.label} className="flex items-center gap-2 text-zinc-500">
                    <SpeakerHigh size={13} weight="duotone" className="text-orange-400/60" />
                    <span className="text-xs">{hint.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Handles positioned relative to wrapper div (outside content container) */}
        {/* Always render handles but hide with opacity - React Flow needs handles in DOM */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: selected || isHovered ? 1 : 0, scale: selected || isHovered ? 1 : 0.5 }}
          transition={{ duration: 0.2 }}
          className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 nopan nodrag"
          style={{ marginLeft: '-12px', pointerEvents: selected || isHovered ? 'auto' : 'none' }}
        >
          <div className="w-6 h-6 rounded-full border-2 border-orange-500 bg-zinc-900 flex items-center justify-center cursor-crosshair hover:bg-orange-500/10 transition-colors">
            <Plus size={14} weight="bold" className="text-orange-500 pointer-events-none" />
            <Handle
              id="input-ui"
              type="target"
              position={Position.Left}
              className="!absolute !inset-0 !w-full !h-full !bg-transparent !border-0 !rounded-full !transform-none"
            />
          </div>
        </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: selected || isHovered ? 1 : 0, scale: selected || isHovered ? 1 : 0.5 }}
        transition={{ duration: 0.2 }}
        className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 nopan nodrag"
        style={{ marginRight: '-12px', pointerEvents: selected || isHovered ? 'auto' : 'none' }}
      >
        <div className="w-6 h-6 rounded-full border-2 border-orange-500 bg-zinc-900 flex items-center justify-center cursor-crosshair hover:bg-orange-500/10 transition-colors">
          <Plus size={14} weight="bold" className="text-orange-500 pointer-events-none" />
          <Handle
            id="output"
            type="source"
            position={Position.Right}
            className="!absolute !inset-0 !w-full !h-full !bg-transparent !border-0 !rounded-full !transform-none"
          />
        </div>
      </motion.div>
      </div>

    {/* Prompt input box using NodeToolbar positioned at bottom */}
    <NodeToolbar
      isVisible={selected}
      position={Position.Bottom}
      offset={12}
    >
      <div className="rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-md shadow-xl overflow-hidden nopan nodrag">
        {/* Text input area */}
        <div className="p-2.5 space-y-2">
          <textarea
            value={nodeData.text || ""}
            onChange={(e) => nodeData.onDataChange?.(id, { text: e.target.value })}
            placeholder="Enter text to convert to speech..."
            rows={3}
            className={cn(
              "w-full bg-transparent border-0 text-sm text-zinc-200 placeholder:text-zinc-600 resize-none outline-none",
            )}
          />

          {nodeData.error && (
            <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-2">
              <span className="text-[11px] text-red-400">{nodeData.error}</span>
              <button
                onClick={handleGenerate}
                className="text-red-400 hover:text-red-300"
                aria-label="Retry generation"
                title="Retry generation"
              >
                <ArrowClockwise size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Bottom bar: badge + generate */}
        <div className="border-t border-white/5 px-3 py-2.5 flex flex-nowrap items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
            Beta
          </span>

          <div className="flex-1" />

          <Button
            onClick={handleGenerate}
            disabled={nodeData.isGenerating}
            size="sm"
            className="text-xs"
            variant={nodeData.isGenerating ? "secondary" : "default"}
          >
            {nodeData.isGenerating ? (
              <CircleNotch size={12} className="animate-spin" />
            ) : (
              <Play size={10} weight="fill" />
            )}
          </Button>
        </div>
      </div>
    </NodeToolbar>

    {/* Fullscreen Dialog */}
    {nodeData.generatedAudioUrl && (
      <Dialog open={isFullscreenOpen} onOpenChange={setIsFullscreenOpen}>
        <DialogContent className="!w-screen !h-screen !max-w-none !m-0 !p-0 gap-0 overflow-hidden border-0 !rounded-none !translate-x-0 !translate-y-0 !left-0 !top-0 !fixed !inset-0">
          <button
            onClick={() => setIsFullscreenOpen(false)}
            className="absolute top-6 right-6 z-10 rounded-full p-2.5 bg-zinc-900/80 backdrop-blur-md hover:bg-zinc-800/80 transition-colors"
            title="Close fullscreen"
          >
            <X size={24} className="text-white" />
          </button>
          <div 
            className="w-full h-full flex items-center justify-center bg-zinc-950 p-4"
            onClick={() => setIsFullscreenOpen(false)}
          >
            <div className="w-full max-w-2xl p-8 bg-zinc-900 rounded-xl">
              <h3 className="text-lg font-medium text-orange-400 mb-4">{title}</h3>
              <audio
                src={nodeData.generatedAudioUrl}
                controls
                autoPlay
                className="w-full"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  )
})

AudioNodeComponent.displayName = 'AudioNodeComponent'

function ToolbarIconButton({ 
  icon: Icon, 
  onClick, 
  label 
}: { 
  icon: React.ElementType
  onClick?: () => void
  label?: string
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-zinc-400 hover:text-zinc-200"
      aria-label={label || "Toolbar action"}
      title={label || "Toolbar action"}
      onClick={onClick}
    >
      <Icon size={16} />
    </Button>
  )
}
