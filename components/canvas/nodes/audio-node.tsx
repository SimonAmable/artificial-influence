"use client"

import * as React from "react"
import {
  Handle,
  Position,
  NodeToolbar,
  type NodeProps,
  useStore,
  useNodes,
  useEdges,
  getIncomers,
} from "@xyflow/react"
import {
  CircleNotch,
  Play,
  ArrowClockwise,
  ArrowsOut,
  DownloadSimple,
  Plus,
  X,
  PaperPlaneTilt,
  FloppyDisk,
} from "@phosphor-icons/react"
import { motion } from "framer-motion"
import type { AudioNodeData, TextNodeData } from "@/lib/canvas/types"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { CreateAssetDialog } from "@/components/canvas/create-asset-dialog"
import { InworldVoiceSelector } from "@/components/audio/inworld-voice-selector"
import {
  DEFAULT_INWORLD_TTS_MODEL,
  INWORLD_TTS_MODEL_OPTIONS,
} from "@/lib/constants/inworld-tts"
import { useFlowMultiSelectActive } from "@/hooks/use-flow-multi-select-active"
import { useNodeErrorToast } from "@/hooks/use-node-error-toast"

export const AudioNodeComponent = React.memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as AudioNodeData
  useNodeErrorToast(id, nodeData.error)
  const multiSelectActive = useFlowMultiSelectActive()
  const { isConnecting, connectingFromId } = useStore((state) => ({
    isConnecting: state.connection.inProgress,
    connectingFromId: state.connection.fromHandle?.nodeId,
  }))
  const nodes = useNodes()
  const edges = useEdges()

  const { connectedPrompt } = React.useMemo(() => {
    const currentNode = nodes.find((n) => n.id === id)
    if (!currentNode) return { connectedPrompt: "" }

    const incomingNodes = getIncomers(currentNode, nodes, edges)
    const textNodes = incomingNodes.filter((node) => node.type === "text")
    const combinedText = textNodes
      .map((node) => (node.data as TextNodeData).text || "")
      .filter((text) => text.trim())
      .join(" ")

    return { connectedPrompt: combinedText }
  }, [edges, id, nodes])

  React.useEffect(() => {
    if (connectedPrompt !== (nodeData.connectedPrompt || "")) {
      nodeData.onDataChange?.(id, { connectedPrompt })
    }
  }, [connectedPrompt, nodeData, id])

  const fullSpeechText = React.useMemo(
    () =>
      [connectedPrompt, nodeData.text || ""]
        .filter((p) => p.trim())
        .join(" ")
        .trim(),
    [connectedPrompt, nodeData.text]
  )

  const [isHovered, setIsHovered] = React.useState(false)
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [title, setTitle] = React.useState(nodeData.label || "Audio")
  const titleInputRef = React.useRef<HTMLInputElement>(null)
  const [isFullscreenOpen, setIsFullscreenOpen] = React.useState(false)
  const [isCreateAssetOpen, setIsCreateAssetOpen] = React.useState(false)

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
      const extensionMatch = new URL(nodeData.generatedAudioUrl).pathname.match(
        /\.([a-z0-9]+)$/i
      )
      const extension = extensionMatch?.[1] ?? "wav"

      const link = document.createElement('a')
      link.href = url
      link.download = `${title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.${extension}`
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
    if (!fullSpeechText) {
      nodeData.onDataChange?.(id, {
        error: "Enter text or connect a Text node with script to generate audio",
      })
      return
    }

    if (!nodeData.voice.trim()) {
      nodeData.onDataChange?.(id, { error: "Choose an Inworld voice first" })
      return
    }

    nodeData.onDataChange?.(id, { isGenerating: true, error: null })

    try {
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: fullSpeechText,
          voice: nodeData.voice,
          model: nodeData.model || DEFAULT_INWORLD_TTS_MODEL,
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
        isVisible={selected && !multiSelectActive && hasContent}
        position={Position.Top}
        offset={35}
      >
        <div className="rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-md shadow-xl px-2 py-2 flex flex-nowrap items-center gap-2 overflow-x-auto nopan nodrag">
          <ToolbarIconButton icon={PaperPlaneTilt} onClick={handleSendToChat} label="Send to AI Chat" />
          <div className="w-px h-5 bg-white/10" />

          <ToolbarIconButton icon={DownloadSimple} onClick={handleDownload} label="Download" />
          <ToolbarIconButton icon={FloppyDisk} onClick={() => setIsCreateAssetOpen(true)} label="Create Asset" />
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
            className="text-base font-medium text-orange-400 uppercase tracking-wider bg-transparent border border-orange-500/40 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-orange-500/40"
          />
        ) : (
          <span 
            className={cn(
              "text-base font-medium text-orange-400 uppercase tracking-wider",
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
            <div className="w-full h-full px-4 flex items-center justify-center">
              <p className="text-xs text-zinc-500 text-center leading-relaxed max-w-[220px]">
                Type script below or connect a Text node, pick an Inworld voice and model, then generate.
              </p>
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
      isVisible={selected && !multiSelectActive}
      position={Position.Bottom}
      offset={12}
    >
        <div className="rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-md shadow-xl overflow-hidden nopan nodrag">
          {/* Text input area */}
          <div className="p-2.5 space-y-2">
            {connectedPrompt.trim() ? (
              <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 [.react-flow.light_&]:border-zinc-300/90 [.react-flow.light_&]:bg-zinc-100/95">
                <span className="text-xs text-zinc-500 [.react-flow.light_&]:text-zinc-600">
                  From connections:{" "}
                </span>
                <span className="text-xs text-zinc-300 line-clamp-3 [.react-flow.light_&]:text-zinc-800">
                  {connectedPrompt}
                </span>
              </div>
            ) : null}
            <textarea
            value={nodeData.text || ""}
            onChange={(e) => nodeData.onDataChange?.(id, { text: e.target.value })}
            placeholder="Additional copy (optional if a Text node is connected)…"
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

        {/* Bottom bar: controls + generate */}
        <div className="border-t border-white/5 px-3 py-2.5 flex flex-nowrap items-center gap-2 overflow-x-auto">
          <Select
            value={nodeData.model || DEFAULT_INWORLD_TTS_MODEL}
            onValueChange={(value) =>
              nodeData.onDataChange?.(id, { model: value, error: null })
            }
          >
            <SelectTrigger className="h-8 min-w-[140px] shrink-0 bg-zinc-800/80 border-white/10 text-xs">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Current</SelectLabel>
                {INWORLD_TTS_MODEL_OPTIONS.filter(
                  (option) => option.group === "Current"
                ).map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Legacy</SelectLabel>
                {INWORLD_TTS_MODEL_OPTIONS.filter(
                  (option) => option.group === "Legacy"
                ).map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <InworldVoiceSelector
            className="max-w-[260px] shrink-0 space-y-0!"
            triggerClassName="min-w-[120px]"
            value={nodeData.voice || ""}
            onValueChange={(voice) =>
              nodeData.onDataChange?.(id, { voice, error: null })
            }
          />

          <div className="flex-1 min-w-2" />

          <Button
            onClick={handleGenerate}
            disabled={nodeData.isGenerating || !nodeData.voice || !fullSpeechText}
            size="sm"
            className="h-8 w-8 px-0"
            variant={nodeData.isGenerating ? "secondary" : "default"}
            title="Generate audio"
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

    {nodeData.generatedAudioUrl && (
      <CreateAssetDialog
        open={isCreateAssetOpen}
        onOpenChange={setIsCreateAssetOpen}
        initial={{
          title,
          url: nodeData.generatedAudioUrl,
          assetType: "audio",
          sourceNodeType: "audio",
        }}
      />
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
