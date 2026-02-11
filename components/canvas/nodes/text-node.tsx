"use client"

import * as React from "react"
import { Handle, Position, NodeToolbar, type NodeProps, useReactFlow, useNodes, useEdges, getIncomers, useStore } from "@xyflow/react"
import {
  ArrowsOut,
  DownloadSimple,
  Plus,
  X,
  ArrowUp,
  PaperPlaneTilt
} from "@phosphor-icons/react"
import { motion } from "framer-motion"
import type { TextNodeData, UploadNodeData, ImageGenNodeData } from "@/lib/canvas/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import Image from "next/image"

// Calculate node dimensions based on text content
const calculateNodeDimensions = (text: string) => {
  const MIN_WIDTH = 280
  const MIN_HEIGHT = 280
  const MAX_WIDTH = 600
  const MAX_HEIGHT = 800
  
  if (!text || text.trim().length === 0) {
    return { width: MIN_WIDTH, height: MIN_HEIGHT }
  }
  
  // Estimate based on character count (rough approximation)
  const charCount = text.length
  const lineCount = text.split('\n').length
  
  // Calculate width (expand horizontally first)
  let width = MIN_WIDTH
  if (charCount > 500) {
    width = Math.min(MAX_WIDTH, MIN_WIDTH + Math.floor((charCount - 500) / 3))
  }
  
  // Calculate height based on line count and char count
  let height = MIN_HEIGHT
  const estimatedLines = Math.max(lineCount, Math.ceil(charCount / 50))
  if (estimatedLines > 18) {
    height = Math.min(MAX_HEIGHT, MIN_HEIGHT + (estimatedLines - 18) * 15)
  }
  
  return { width, height }
}

export const TextNodeComponent = React.memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as TextNodeData
  const [isHovered, setIsHovered] = React.useState(false)
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [title, setTitle] = React.useState(nodeData.label || "Text")
  const titleInputRef = React.useRef<HTMLInputElement>(null)
  const [isFullscreenOpen, setIsFullscreenOpen] = React.useState(false)
  const [isFocused, setIsFocused] = React.useState(false)
  const [previousViewport, setPreviousViewport] = React.useState<{ x: number; y: number; zoom: number } | null>(null)
  const reactFlow = useReactFlow()
  const { isConnecting, connectingFromId } = useStore((state) => ({
    isConnecting: state.connection.inProgress,
    connectingFromId: state.connection.fromHandle?.nodeId,
  }))
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const nodeRef = React.useRef<HTMLDivElement>(null)
  const nodes = useNodes()
  const edges = useEdges()
  
  // Calculate dynamic dimensions
  const dimensions = React.useMemo(() => calculateNodeDimensions(nodeData.text || ''), [nodeData.text])

  // Track connected nodes for text and image inputs
  const { connectedPrompt, connectedImageUrls } = React.useMemo(() => {
    const currentNode = nodes.find(n => n.id === id)
    if (!currentNode) return { connectedPrompt: '', connectedImageUrls: [] as string[] }

    const incomingNodes = getIncomers(currentNode, nodes, edges)
    
    // Get text from text nodes
    const textNodes = incomingNodes.filter(node => node.type === 'text')
    const combinedText = textNodes
      .map(node => (node.data as TextNodeData).text || '')
      .filter(text => text.trim())
      .join('\n\n')
    
    // Get image references from upload or image-gen nodes
    const imageNodes = incomingNodes.filter(node => node.type === 'upload' || node.type === 'image-gen')
    const imageUrls: string[] = []
    
    for (const node of imageNodes) {
      if (node.type === 'upload') {
        const uploadData = node.data as UploadNodeData
        if (uploadData.fileUrl && uploadData.fileType === 'image') {
          imageUrls.push(uploadData.fileUrl)
        }
      } else if (node.type === 'image-gen') {
        const imageGenData = node.data as ImageGenNodeData
        if (imageGenData.generatedImageUrl) {
          imageUrls.push(imageGenData.generatedImageUrl)
        }
      }
    }

    const uniqueImageUrls = Array.from(new Set(imageUrls))
    
    return { connectedPrompt: combinedText, connectedImageUrls: uniqueImageUrls }
  }, [edges, id, nodes])
  
  // Update node data when connected values change
  React.useEffect(() => {
    if (connectedPrompt !== (nodeData.connectedPrompt || '')) {
      nodeData.onDataChange?.(id, { connectedPrompt })
    }
  }, [connectedPrompt, nodeData, id])
  
  React.useEffect(() => {
    const existingUrls = Array.isArray(nodeData.connectedImageUrls) ? nodeData.connectedImageUrls : []
    const urlsChanged =
      existingUrls.length !== connectedImageUrls.length ||
      existingUrls.some((url, index) => url !== connectedImageUrls[index])
    const firstConnectedUrl = connectedImageUrls[0] || ''
    const firstUrlChanged = firstConnectedUrl !== (nodeData.connectedImageUrl || '')

    if (urlsChanged || firstUrlChanged) {
      nodeData.onDataChange?.(id, {
        connectedImageUrls,
        connectedImageUrl: firstConnectedUrl,
      })
    }
  }, [connectedImageUrls, nodeData, id])

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
      setTitle(nodeData.label || "Text")
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleTitleBlur()
    } else if (e.key === "Escape") {
      setIsEditingTitle(false)
      setTitle(nodeData.label || "Text")
    }
  }

  const handleDownload = async () => {
    if (!nodeData.text?.trim()) return

    try {
      const blob = new Blob([nodeData.text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `${title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch (error) {
      console.error('Error downloading text:', error)
    }
  }

  const handleSendToChat = () => {
    if (!nodeData.text?.trim()) return
    
    const event = new CustomEvent('chat-add-text', {
      detail: { text: nodeData.text }
    })
    window.dispatchEvent(event)
    
    const openChatEvent = new CustomEvent('chat-open')
    window.dispatchEvent(openChatEvent)
  }

  const handleFullscreen = () => {
    if (nodeData.text?.trim()) {
      setIsFullscreenOpen(true)
    }
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    nodeData.onDataChange?.(id, { text: e.target.value })
  }

  const handleDoubleClick = () => {
    if (!isFocused) {
      // Store current viewport
      const viewport = reactFlow.getViewport()
      setPreviousViewport(viewport)
      
      // Get node position and zoom to it
      const node = reactFlow.getNode(id)
      if (node) {
        const padding = 100
        reactFlow.fitBounds(
          {
            x: node.position.x - padding,
            y: node.position.y - padding,
            width: dimensions.width + padding * 2,
            height: dimensions.height + padding * 2,
          },
          { duration: 600 }
        )
      }
      
      // Enter focus mode
      setTimeout(() => {
        setIsFocused(true)
        // Focus the textarea after a brief delay
        setTimeout(() => {
          textareaRef.current?.focus()
        }, 100)
      }, 300)
    }
  }

  const handleExitFocus = React.useCallback(() => {
    setIsFocused(false)
    
    // Restore previous viewport
    if (previousViewport) {
      reactFlow.setViewport(previousViewport, { duration: 600 })
      setPreviousViewport(null)
    }
  }, [previousViewport, reactFlow])
  
  // Handle click outside to exit focus mode
  React.useEffect(() => {
    if (!isFocused) return

    const handleClickOutside = (event: MouseEvent) => {
      if (nodeRef.current && !nodeRef.current.contains(event.target as Node)) {
        handleExitFocus()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isFocused, handleExitFocus])

  const hasContent = !!nodeData.text?.trim()

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
          
          <span className="text-[10px] text-zinc-500 px-1">Prompt, ad copy, context</span>

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
            className="text-xs font-medium text-emerald-400 uppercase tracking-wider bg-transparent border border-emerald-500/40 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-emerald-500/40"
          />
        ) : (
          <span 
            className={cn(
              "text-xs font-medium text-emerald-400 uppercase tracking-wider",
              selected && "cursor-pointer hover:text-emerald-300 transition-colors"
            )}
          >
            {title}
          </span>
        )}
      </div>

      {/* Wrapper to allow handles to overflow */}
      <div 
        ref={nodeRef}
        className={cn(
          "relative transition-all duration-300",
          isConnecting && connectingFromId !== id && "easy-connect-glow"
        )}
        style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onDoubleClick={handleDoubleClick}
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
            "rounded-xl border bg-zinc-900 shadow-lg flex flex-col",
            selected
              ? "border-emerald-500/40 ring-1 ring-emerald-500/20"
              : "border-white/10 hover:border-white/20"
          )}
        >

          {/* Content area: loading state, hints OR text preview OR editable text */}
          {nodeData.isGenerating ? (
            <div className="relative w-full h-full overflow-hidden bg-zinc-900 rounded-xl">
              {/* Progress fill */}
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-zinc-800 to-zinc-700"
                style={{
                  width: '0%',
                  animation: 'fillProgress 5s linear infinite',
                  boxShadow: '2px 0 8px 0 rgba(52, 211, 153, 0.4)'
                }}
              />
              {/* Overlay gradient for depth */}
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/30 via-transparent to-zinc-900/30 pointer-events-none" />
              <style jsx>{`
                @keyframes fillProgress {
                  0% {
                    width: 0%;
                  }
                  100% {
                    width: 100%;
                  }
                }
              `}</style>
            </div>
          ) : (
          <div className="px-3 py-3 flex-1 overflow-hidden flex flex-col gap-2">
            {/* Connected image reference for AI */}
            {connectedImageUrls.length > 0 && (
              <div className="relative w-full h-20 rounded border border-emerald-500/20 overflow-hidden flex-shrink-0">
                <Image
                  src={connectedImageUrls[0]}
                  alt="Reference image"
                  fill
                  className="object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 to-transparent flex items-end p-1.5">
                  <span className="text-[9px] text-emerald-400/80 uppercase tracking-wider">
                    {connectedImageUrls.length > 1
                      ? `Reference Images (${connectedImageUrls.length})`
                      : "Reference Image"}
                  </span>
                </div>
              </div>
            )}

            {/* Connected text prompt (greyed, italic, uneditable) */}
            {connectedPrompt && (
              <p className="text-xs text-zinc-500 italic whitespace-pre-wrap border-l-2 border-emerald-500/30 pl-2 flex-shrink-0 max-h-16 overflow-auto">
                {connectedPrompt}
              </p>
            )}

            {/* Main text content */}
            <div className="flex-1 overflow-hidden">
              {isFocused ? (
                <textarea
                  ref={textareaRef}
                  value={nodeData.text || ""}
                  onChange={handleTextChange}
                  placeholder="Enter your text, script, or prompt..."
                  className="w-full h-full bg-transparent border-0 text-xs text-zinc-200 placeholder:text-zinc-600 resize-none outline-none nopan nodrag"
                />
              ) : hasContent ? (
                <p className="text-xs text-zinc-300 whitespace-pre-wrap overflow-auto h-full">
                  {nodeData.text}
                </p>
              ) : (
                <div className="w-full h-full px-4 flex items-center justify-center">
                  <p className="text-xs text-zinc-500 text-center leading-relaxed max-w-[220px]">
                    Write your script, copy, or prompt here, then connect it to image, video, or audio nodes.
                  </p>
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Handles positioned relative to wrapper div (outside content container) */}
        {/* Always render handle but hide with opacity - React Flow needs handles in DOM */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: selected || isHovered ? 1 : 0, scale: selected || isHovered ? 1 : 0.5 }}
          transition={{ duration: 0.2 }}
          className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 nopan nodrag"
          style={{ marginRight: '-12px', pointerEvents: selected || isHovered ? 'auto' : 'none' }}
        >
          <div className="w-6 h-6 rounded-full border-2 border-emerald-500 bg-zinc-900 flex items-center justify-center cursor-crosshair hover:bg-emerald-500/10 transition-colors">
            <Plus size={14} weight="bold" className="text-emerald-500 pointer-events-none" />
            <Handle
              id="output"
              type="source"
              position={Position.Right}
              className="!absolute !inset-0 !w-full !h-full !bg-transparent !border-0 !rounded-full !transform-none"
            />
          </div>
        </motion.div>
      </div>

    {/* AI Chat input using NodeToolbar positioned at bottom */}
    <NodeToolbar
      isVisible={selected && !isFocused}
      position={Position.Bottom}
      offset={12}
    >
      <AITextInput nodeId={id} nodeData={nodeData} />
    </NodeToolbar>

    {/* Fullscreen Dialog */}
    {nodeData.text?.trim() && (
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
            className="w-full h-full flex items-center justify-center bg-zinc-950 p-8 overflow-auto"
            onClick={() => setIsFullscreenOpen(false)}
          >
            <div className="w-full max-w-4xl p-8 bg-zinc-900 rounded-xl pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-medium text-emerald-400 mb-4">{title}</h3>
              <p className="text-base text-zinc-200 whitespace-pre-wrap leading-relaxed">
                {nodeData.text}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  )
})

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

TextNodeComponent.displayName = 'TextNodeComponent'

// AI Text Input Component
interface AITextInputProps {
  nodeId: string
  nodeData: TextNodeData
}

const AITextInput = ({ nodeId, nodeData }: AITextInputProps) => {
  const [input, setInput] = React.useState('')
  const [files, setFiles] = React.useState<FileList | undefined>(undefined)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [uploadedPreviewUrls, setUploadedPreviewUrls] = React.useState<string[]>([])

  React.useEffect(() => {
    console.log('[AITextInput] Component mounted for node:', nodeId)
    console.log('[AITextInput] onDataChange available:', !!nodeData.onDataChange)
  }, [nodeId, nodeData.onDataChange])

  React.useEffect(() => {
    if (!files || files.length === 0) {
      setUploadedPreviewUrls([])
      return
    }

    const urls = Array.from(files).map((file) => URL.createObjectURL(file))
    setUploadedPreviewUrls(urls)

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [files])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && !files) return

    setIsGenerating(true)
    nodeData.onDataChange?.(nodeId, { isGenerating: true })

    try {
      console.log('[AITextInput] Sending prompt:', input)
      console.log('[AITextInput] Current text:', nodeData.text)
      console.log('[AITextInput] Files attached:', files?.length || 0)

      // Convert files to data URLs for images/videos
      const imageData: Array<{ url: string; mediaType: string }> = []

      // Include images connected via node input handles as prompt references
      if (Array.isArray(nodeData.connectedImageUrls) && nodeData.connectedImageUrls.length > 0) {
        nodeData.connectedImageUrls.forEach((url) => {
          if (url && typeof url === 'string') {
            imageData.push({
              url,
              mediaType: 'image/*',
            })
          }
        })
      } else if (typeof nodeData.connectedImageUrl === 'string' && nodeData.connectedImageUrl) {
        imageData.push({
          url: nodeData.connectedImageUrl,
          mediaType: 'image/*',
        })
      }

      if (files && files.length > 0) {
        const uploadedImageData = await Promise.all(
          Array.from(files)
            .filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'))
            .map(
              file =>
                new Promise<{ url: string; mediaType: string }>((resolve, reject) => {
                  const reader = new FileReader()
                  reader.onload = () => {
                    resolve({
                      url: reader.result as string,
                      mediaType: file.type,
                    })
                  }
                  reader.onerror = () => reject(new Error('Failed to read file'))
                  reader.readAsDataURL(file)
                }),
            ),
        )
        imageData.push(...uploadedImageData)
      }

      // Call simple generate-text API
      const response = await fetch('/api/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: input,
          currentText: nodeData.text || '',
          images: imageData.length > 0 ? imageData : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate text')
      }

      const data = await response.json()
      console.log('[AITextInput] Received response:', data.text?.substring(0, 100) + '...')

      // Update the text node with generated text
      if (data.text) {
        nodeData.onDataChange?.(nodeId, { text: data.text, isGenerating: false })
        console.log('[AITextInput] Text updated successfully')
      }

      // Clear input
      setInput('')
      setFiles(undefined)
      setUploadedPreviewUrls([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('[AITextInput] Error generating text:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate text')
    } finally {
      setIsGenerating(false)
      nodeData.onDataChange?.(nodeId, { isGenerating: false })
    }
  }

  return (
    <div className="w-[460px] max-w-[92vw] rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-md shadow-xl overflow-hidden nopan nodrag">
      <div className="p-3">
        <form onSubmit={handleSubmit}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files) {
                setFiles(e.target.files)
              }
            }}
            accept="image/*,video/*"
            multiple
            className="hidden"
          />

          <div className="space-y-3">
            {Array.isArray(nodeData.connectedImageUrls) && nodeData.connectedImageUrls.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">
                  Connected References ({nodeData.connectedImageUrls.length})
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {nodeData.connectedImageUrls.map((url, index) => (
                    <div key={`${url}-${index}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-emerald-500/25 bg-zinc-950">
                      <Image
                        src={url}
                        alt={`Connected reference ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {files && files.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Uploaded References ({files.length})
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {Array.from(files).map((file, index) => (
                    <div key={`${file.name}-${index}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-white/15 bg-zinc-950">
                      {file.type.startsWith('image/') && uploadedPreviewUrls[index] ? (
                        <Image
                          src={uploadedPreviewUrls[index]}
                          alt={file.name}
                          fill
                          className="object-cover"
                        />
                      ) : file.type.startsWith('video/') && uploadedPreviewUrls[index] ? (
                        <video
                          src={uploadedPreviewUrls[index]}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          const dt = new DataTransfer()
                          Array.from(files)
                            .filter((_, i) => i !== index)
                            .forEach(f => dt.items.add(f))
                          setFiles(dt.files.length > 0 ? dt.files : undefined)
                          if (fileInputRef.current) {
                            fileInputRef.current.files = dt.files
                          }
                        }}
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/75 text-[10px] leading-none text-white hover:bg-black"
                        aria-label={`Remove ${file.name}`}
                        title="Remove"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              placeholder="Ask AI to write, edit, or improve this text..."
              rows={4}
              disabled={isGenerating}
              className="w-full min-h-28 max-h-80 rounded-md bg-transparent px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none resize-y disabled:opacity-50"
            />

            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 h-8 w-8 text-zinc-400 hover:text-zinc-200"
                disabled={isGenerating}
                title="Add reference image or video"
              >
                <Plus className="h-4 w-4" />
              </Button>

              <Button
                type="submit"
                size="icon"
                disabled={(!input.trim() && !files) || isGenerating}
                className="shrink-0 h-8 w-8 bg-emerald-500 hover:bg-emerald-600 text-zinc-900"
                title="Generate text"
              >
                <ArrowUp className="h-4 w-4" weight="bold" />
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
