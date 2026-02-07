"use client"

import * as React from "react"
import { Handle, Position, NodeToolbar, type NodeProps, useReactFlow, useUpdateNodeInternals, type Node } from "@xyflow/react"
import {
  Upload,
  X,
  File,
  Image as ImageIcon,
  VideoCamera,
  SpeakerHigh,
  ArrowsOut,
  DownloadSimple,
  Plus,
  FrameCorners,
  SquareHalfBottom,
  CircleNotch,
  PaperPlaneTilt,
  PencilSimple,
} from "@phosphor-icons/react"
import { motion } from "framer-motion"
import type { UploadNodeData } from "@/lib/canvas/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { extractFirstFrame, extractLastFrame } from "@/lib/canvas/frame-extraction"
import { createUploadNodeData } from "@/lib/canvas/types"
import { uploadBlobToSupabase, uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { getConstrainedSize, loadImageSize, loadVideoSize } from "@/lib/canvas/media-sizing"
import { ImageEditorDialog } from "@/components/image-editor"

const hintSuggestions = [
  { icon: ImageIcon, label: "Image" },
  { icon: VideoCamera, label: "Video" },
  { icon: SpeakerHigh, label: "Audio" },
]

export const UploadNodeComponent = React.memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as UploadNodeData
  const inputRef = React.useRef<HTMLInputElement>(null)
  const reactFlow = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const nodeCounterRef = React.useRef(Date.now())
  const [isHovered, setIsHovered] = React.useState(false)
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [title, setTitle] = React.useState(nodeData.label || "Upload")
  const titleInputRef = React.useRef<HTMLInputElement>(null)
  const [isFullscreenOpen, setIsFullscreenOpen] = React.useState(false)
  const [isExtractingFrame, setIsExtractingFrame] = React.useState(false)
  const [isEditorOpen, setIsEditorOpen] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  
  // Get current node to read its dimensions
  const currentNode = reactFlow.getNode(id)
  const nodeWidth = currentNode?.style?.width || currentNode?.width || 280
  const nodeHeight = currentNode?.style?.height || currentNode?.height || 280

  const applyNodeSize = React.useCallback((width: number, height: number) => {
    const existing = reactFlow.getNode(id)
    const existingWidth = existing?.style?.width ?? existing?.width
    const existingHeight = existing?.style?.height ?? existing?.height
    if (existingWidth === width && existingHeight === height) return

    reactFlow.updateNode(id, {
      style: { width, height },
    })
    updateNodeInternals(id)
  }, [id, reactFlow, updateNodeInternals])

  React.useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  // Size node when it mounts with pre-existing file data (e.g., from frame extraction)
  React.useEffect(() => {
    if (!nodeData.fileUrl) return
    
    if (nodeData.fileType === 'image') {
      loadImageSize(nodeData.fileUrl)
        .then((size) => {
          const constrained = getConstrainedSize(size)
          applyNodeSize(constrained.width, constrained.height)
        })
        .catch(() => {
          // Ignore load errors; keep existing size
        })
    } else if (nodeData.fileType === 'video') {
      loadVideoSize(nodeData.fileUrl)
        .then((size) => {
          const constrained = getConstrainedSize(size)
          applyNodeSize(constrained.width, constrained.height)
        })
        .catch(() => {
          // Ignore load errors; keep existing size
        })
    }
  }, [nodeData.fileUrl, nodeData.fileType, applyNodeSize])

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
      setTitle(nodeData.label || "Upload")
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleTitleBlur()
    } else if (e.key === "Escape") {
      setIsEditingTitle(false)
      setTitle(nodeData.label || "Upload")
    }
  }

  const handleDownload = async () => {
    if (!nodeData.fileUrl) return

    try {
      const response = await fetch(nodeData.fileUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      
      const extension = nodeData.fileType === 'image' ? 'png' : 
                       nodeData.fileType === 'video' ? 'mp4' : 
                       nodeData.fileType === 'audio' ? 'mp3' : 'file'
      
      const link = document.createElement('a')
      link.href = url
      link.download = nodeData.fileName || `${title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.${extension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch (error) {
      console.error('Error downloading file:', error)
    }
  }

  const handleSendToChat = () => {
    if (!nodeData.fileUrl || !nodeData.fileType) return
    
    const event = new CustomEvent('chat-add-asset', {
      detail: { url: nodeData.fileUrl, type: nodeData.fileType }
    })
    window.dispatchEvent(event)
    
    const openChatEvent = new CustomEvent('chat-open')
    window.dispatchEvent(openChatEvent)
  }

  const handleFullscreen = () => {
    if (nodeData.fileUrl) {
      setIsFullscreenOpen(true)
    }
  }

  const handleExtractFirstFrame = async () => {
    if (!nodeData.fileUrl || nodeData.fileType !== 'video') return
    
    setIsExtractingFrame(true)
    try {
      const frame = await extractFirstFrame(
        nodeData.fileUrl,
        nodeData.fileName?.replace(/\.[^/.]+$/, '') // Remove extension
      )

      // Get current node position
      const currentNode = reactFlow.getNode(id)
      if (!currentNode) return

      // Create new upload node with extracted frame
      nodeCounterRef.current += 1
      const newNodeId = `upload-${Date.now()}-${nodeCounterRef.current}`
      
      const newNode: Node = {
        id: newNodeId,
        type: 'upload',
        position: {
          x: currentNode.position.x + (currentNode.width || 300) + 30,
          y: currentNode.position.y,
        },
        data: {
          ...createUploadNodeData(),
          fileUrl: frame.url,
          fileType: 'image' as const,
          fileName: frame.filename,
          label: 'First Frame',
          onDataChange: nodeData.onDataChange,
        },
      }

      reactFlow.addNodes(newNode)
      
      const uploadResult = await uploadBlobToSupabase(frame.blob, frame.filename, 'uploads')
      if (uploadResult) {
        reactFlow.setNodes((nodes) =>
          nodes.map((n) =>
            n.id === newNodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    fileUrl: uploadResult.url,
                    fileType: uploadResult.fileType,
                    fileName: uploadResult.fileName,
                  },
                }
              : n
          )
        )
        URL.revokeObjectURL(frame.url)
      }
    } catch (error) {
      console.error('Error extracting first frame:', error)
    } finally {
      setIsExtractingFrame(false)
    }
  }

  const handleExtractLastFrame = async () => {
    if (!nodeData.fileUrl || nodeData.fileType !== 'video') return
    
    setIsExtractingFrame(true)
    try {
      const frame = await extractLastFrame(
        nodeData.fileUrl,
        nodeData.fileName?.replace(/\.[^/.]+$/, '') // Remove extension
      )

      // Get current node position
      const currentNode = reactFlow.getNode(id)
      if (!currentNode) return

      // Create new upload node with extracted frame
      nodeCounterRef.current += 1
      const newNodeId = `upload-${Date.now()}-${nodeCounterRef.current}`
      
      const newNode: Node = {
        id: newNodeId,
        type: 'upload',
        position: {
          x: currentNode.position.x + (currentNode.width || 300) + 30,
          y: currentNode.position.y + 100, // Offset vertically for last frame
        },
        data: {
          ...createUploadNodeData(),
          fileUrl: frame.url,
          fileType: 'image' as const,
          fileName: frame.filename,
          label: 'Last Frame',
          onDataChange: nodeData.onDataChange,
        },
      }

      reactFlow.addNodes(newNode)
      
      const uploadResult = await uploadBlobToSupabase(frame.blob, frame.filename, 'uploads')
      if (uploadResult) {
        reactFlow.setNodes((nodes) =>
          nodes.map((n) =>
            n.id === newNodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    fileUrl: uploadResult.url,
                    fileType: uploadResult.fileType,
                    fileName: uploadResult.fileName,
                  },
                }
              : n
          )
        )
        URL.revokeObjectURL(frame.url)
      }
    } catch (error) {
      console.error('Error extracting last frame:', error)
    } finally {
      setIsExtractingFrame(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show blob URL immediately for instant preview
    const blobUrl = URL.createObjectURL(file)
    let fileType: "image" | "video" | "audio" | null = null
    if (file.type.startsWith("image/")) fileType = "image"
    else if (file.type.startsWith("video/")) fileType = "video"
    else if (file.type.startsWith("audio/")) fileType = "audio"

    const currentNode = reactFlow.getNode(id)
    if (!currentNode) return

    // For images and videos, calculate dimensions and recreate node
    if (fileType === "image") {
      const img = new Image()
      img.onload = async () => {
        const constrained = getConstrainedSize({
          width: img.naturalWidth,
          height: img.naturalHeight,
        })
        
        // Show blob URL immediately for instant preview
        const updatedNodePreview: Node = {
          ...currentNode,
          data: {
            ...currentNode.data,
            fileUrl: blobUrl,
            fileType,
            fileName: file.name,
          },
          style: {
            ...currentNode.style,
            width: constrained.width,
            height: constrained.height,
          },
        }
        
        reactFlow.setNodes((nodes) => nodes.map((n) => (n.id === id ? updatedNodePreview : n)))
        updateNodeInternals(id)
        
        // Upload to Supabase in background
        setIsUploading(true)
        const uploadResult = await uploadFileToSupabase(file, 'uploads')
        setIsUploading(false)
        
        if (uploadResult) {
          // Replace blob URL with Supabase URL
          URL.revokeObjectURL(blobUrl)
          reactFlow.setNodes((nodes) =>
            nodes.map((n) =>
              n.id === id
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      fileUrl: uploadResult.url,
                    },
                  }
                : n
            )
          )
          toast.success('File uploaded successfully')
        }
      }
      img.src = blobUrl
    } else if (fileType === "video") {
      const video = document.createElement('video')
      video.onloadedmetadata = async () => {
        const constrained = getConstrainedSize({
          width: video.videoWidth,
          height: video.videoHeight,
        })
        
        // Show blob URL immediately for instant preview
        const updatedNodePreview: Node = {
          ...currentNode,
          data: {
            ...currentNode.data,
            fileUrl: blobUrl,
            fileType,
            fileName: file.name,
          },
          style: {
            ...currentNode.style,
            width: constrained.width,
            height: constrained.height,
          },
        }
        
        reactFlow.setNodes((nodes) => nodes.map((n) => (n.id === id ? updatedNodePreview : n)))
        updateNodeInternals(id)
        
        // Upload to Supabase in background
        setIsUploading(true)
        const uploadResult = await uploadFileToSupabase(file, 'uploads')
        setIsUploading(false)
        
        if (uploadResult) {
          // Replace blob URL with Supabase URL
          URL.revokeObjectURL(blobUrl)
          reactFlow.setNodes((nodes) =>
            nodes.map((n) =>
              n.id === id
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      fileUrl: uploadResult.url,
                    },
                  }
                : n
            )
          )
          toast.success('File uploaded successfully')
        }
      }
      video.src = blobUrl
    } else {
      // For audio, upload immediately (no preview needed)
      setIsUploading(true)
      const uploadResult = await uploadFileToSupabase(file, 'uploads')
      setIsUploading(false)
      
      if (uploadResult) {
        nodeData.onDataChange?.(id, {
          fileUrl: uploadResult.url,
          fileType,
          fileName: file.name,
        })
        toast.success('File uploaded successfully')
      }
    }
  }

  const handleClear = () => {
    nodeData.onDataChange?.(id, {
      fileUrl: null,
      fileType: null,
      fileName: null,
    })
    
    // Reset to default size
    applyNodeSize(280, 280)
    
    if (inputRef.current) inputRef.current.value = ""
  }

  const FileTypeIcon = nodeData.fileType === "image"
    ? ImageIcon
    : nodeData.fileType === "video"
    ? VideoCamera
    : nodeData.fileType === "audio"
    ? SpeakerHigh
    : File

  const hasContent = !!nodeData.fileUrl

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
          
          <span className="text-[10px] text-zinc-500 px-1">Image · Video · Audio</span>

          <div className="w-px h-5 bg-white/10" />

          {/* Frame extraction buttons - only show for videos */}
          {nodeData.fileType === 'video' && (
            <>
              <ToolbarIconButton 
                icon={FrameCorners} 
                onClick={handleExtractFirstFrame} 
                label="Extract First Frame"
                disabled={isExtractingFrame}
              />
              <ToolbarIconButton 
                icon={SquareHalfBottom} 
                onClick={handleExtractLastFrame} 
                label="Extract Last Frame"
                disabled={isExtractingFrame}
              />
              <div className="w-px h-5 bg-white/10" />
            </>
          )}

          {/* Edit button - only show for images */}
          {nodeData.fileType === 'image' && (
            <>
              <ToolbarIconButton icon={PencilSimple} onClick={() => setIsEditorOpen(true)} label="Edit in Canvas" />
              <div className="w-px h-5 bg-white/10" />
            </>
          )}
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
            className="text-xs font-medium text-zinc-400 uppercase tracking-wider bg-transparent border border-zinc-400/40 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-zinc-400/40"
          />
        ) : (
          <span 
            className={cn(
              "text-xs font-medium text-zinc-400 uppercase tracking-wider",
              selected && "cursor-pointer hover:text-zinc-300 transition-colors"
            )}
          >
            {title}
          </span>
        )}
      </div>

      {/* Wrapper to allow handles to overflow */}
      <div 
        className="relative"
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
        <div
          className={cn(
            "relative transition-all duration-200",
            hasContent && nodeData.fileType === "image"
              ? "rounded-lg overflow-hidden"
              : "rounded-xl border bg-zinc-900 shadow-lg flex flex-col",
            !hasContent && selected
              ? "border-zinc-400/40 ring-1 ring-zinc-400/20"
              : !hasContent && "border-white/10 hover:border-white/20",
            hasContent && nodeData.fileType === "image" && selected && "ring-2 ring-zinc-400/40"
          )}
          style={{ width: nodeWidth, height: nodeHeight }}
        >

          {/* Content area: hints, file info, or media preview */}
          {hasContent && nodeData.fileType === "image" ? (
            <div className="relative" style={{ width: nodeWidth, height: nodeHeight }}>
              <img
                src={nodeData.fileUrl!}
                alt="Preview"
                style={{ width: nodeWidth, height: nodeHeight }}
                className="object-cover"
              />
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <CircleNotch size={24} className="text-white animate-spin" />
                    <span className="text-xs text-white">Uploading...</span>
                  </div>
                </div>
              )}
            </div>
          ) : hasContent && nodeData.fileType === "video" ? (
            <div className="relative" style={{ width: nodeWidth, height: nodeHeight }}>
              <video
                src={nodeData.fileUrl!}
                controls
                style={{ width: nodeWidth, height: nodeHeight }}
                className="object-cover"
              />
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                  <div className="flex flex-col items-center gap-2">
                    <CircleNotch size={24} className="text-white animate-spin" />
                    <span className="text-xs text-white">Uploading...</span>
                  </div>
                </div>
              )}
            </div>
          ) : hasContent && nodeData.fileType === "audio" ? (
            <div className="relative flex items-center justify-center bg-zinc-900 rounded-lg p-4" style={{ width: nodeWidth, height: nodeHeight }}>
              <audio
                src={nodeData.fileUrl!}
                controls
                className="w-full"
              />
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-lg">
                  <div className="flex flex-col items-center gap-2">
                    <CircleNotch size={24} className="text-white animate-spin" />
                    <span className="text-xs text-white">Uploading...</span>
                  </div>
                </div>
              )}
            </div>
          ) : hasContent ? (
            <div className="px-3 py-3">
              <div className="flex items-center gap-2 bg-zinc-800/80 border border-white/10 rounded-lg px-3 py-2.5">
                <FileTypeIcon size={16} className="text-zinc-400 shrink-0" />
                <span className="text-sm text-zinc-300 truncate flex-1">
                  {nodeData.fileName || "File uploaded"}
                </span>
              </div>
            </div>
          ) : (
            <div className="px-3 py-3">
              <div className="py-2 space-y-1.5">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Accepts:</p>
                {hintSuggestions.map((hint) => (
                  <div key={hint.label} className="flex items-center gap-2 text-zinc-500">
                    <hint.icon size={13} weight="duotone" className="text-zinc-400/60" />
                    <span className="text-xs">{hint.label}</span>
                  </div>
                ))}
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
          <div className="w-6 h-6 rounded-full border-2 border-zinc-400 bg-zinc-900 flex items-center justify-center cursor-crosshair hover:bg-zinc-400/10 transition-colors">
            <Plus size={14} weight="bold" className="text-zinc-400 pointer-events-none" />
            <Handle
              id="output"
              type="source"
              position={Position.Right}
              className="!absolute !inset-0 !w-full !h-full !bg-transparent !border-0 !rounded-full !transform-none"
            />
          </div>
        </motion.div>
      </div>

    {/* File picker using NodeToolbar positioned at bottom */}
    <NodeToolbar
      isVisible={selected}
      position={Position.Bottom}
      offset={12}
    >
      <div className="rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-md shadow-xl overflow-hidden nopan nodrag">
        <div className="p-2.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {nodeData.fileUrl ? (
            <div className="flex items-center gap-2 bg-zinc-800/80 border border-white/10 rounded-lg px-3 py-2.5">
              <FileTypeIcon size={16} className="text-zinc-400 shrink-0" />
              <span className="text-sm text-zinc-300 truncate flex-1">
                {nodeData.fileName || "File uploaded"}
              </span>
              <Button
                onClick={handleClear}
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-zinc-500 hover:text-zinc-300 shrink-0"
              >
                <X size={14} />
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => inputRef.current?.click()}
              variant="outline"
              className={cn(
                "w-full flex flex-col items-center gap-2 h-auto py-5 border-dashed",
                "text-zinc-500 hover:text-zinc-300 hover:border-white/25 hover:bg-white/[0.03]"
              )}
            >
              <Upload size={22} weight="duotone" />
              <span className="text-xs">Click or drop file</span>
            </Button>
          )}
        </div>
      </div>
    </NodeToolbar>

    {/* Fullscreen Dialog */}
    {nodeData.fileUrl && (
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
            className="w-full h-full flex items-center justify-center bg-zinc-950 p-4 cursor-pointer"
            onClick={() => setIsFullscreenOpen(false)}
          >
            {nodeData.fileType === "image" ? (
              <img
                src={nodeData.fileUrl}
                alt={title}
                className="w-auto h-auto max-w-[96vw] max-h-[96vh] min-w-[60vw] min-h-[60vh] object-contain pointer-events-none"
              />
            ) : nodeData.fileType === "video" ? (
              <video
                src={nodeData.fileUrl}
                controls
                autoPlay
                className="w-auto h-auto max-w-[96vw] max-h-[96vh] min-w-[60vw] min-h-[60vh] object-contain pointer-events-auto"
              />
            ) : nodeData.fileType === "audio" ? (
              <div className="w-full max-w-2xl p-8 bg-zinc-900 rounded-xl">
                <h3 className="text-lg font-medium text-zinc-400 mb-4">{title}</h3>
                <audio
                  src={nodeData.fileUrl}
                  controls
                  autoPlay
                  className="w-full"
                />
              </div>
            ) : (
              <div className="w-full max-w-2xl p-8 bg-zinc-900 rounded-xl">
                <h3 className="text-lg font-medium text-zinc-400 mb-4">{nodeData.fileName || title}</h3>
                <p className="text-zinc-500">Preview not available for this file type</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )}

    {/* Image Editor Dialog - only for images */}
    {nodeData.fileType === 'image' && (
      <ImageEditorDialog
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        initialImage={nodeData.fileUrl}
        onSave={(editedImageUrl) => {
          nodeData.onDataChange?.(id, { fileUrl: editedImageUrl })
          setIsEditorOpen(false)
        }}
      />
    )}
    </>
  )
})

UploadNodeComponent.displayName = 'UploadNodeComponent'

function ToolbarIconButton({ 
  icon: Icon, 
  onClick, 
  label,
  disabled = false
}: { 
  icon: React.ElementType
  onClick?: () => void
  label?: string
  disabled?: boolean
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-zinc-400 hover:text-zinc-200"
      aria-label={label || "Toolbar action"}
      title={label || "Toolbar action"}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={16} className={disabled ? 'opacity-50' : ''} />
    </Button>
  )
}
