"use client"

import * as React from "react"
import { Handle, Position, NodeToolbar, type NodeProps, useNodes, useEdges, getIncomers, useReactFlow, type Node } from "@xyflow/react"
import { createClient } from "@/lib/supabase/client"
import {
  VideoCamera,
  CircleNotch,
  Play,
  ArrowClockwise,
  ArrowsOut,
  DownloadSimple,
  Plus,
  X,
  Image as ImageIcon,
  FrameCorners,
  SquareHalfBottom,
  PaperPlaneTilt,
} from "@phosphor-icons/react"
import { motion } from "framer-motion"
import type { VideoGenNodeData } from "@/lib/canvas/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { extractFirstFrame, extractLastFrame } from "@/lib/canvas/frame-extraction"
import { createUploadNodeData } from "@/lib/canvas/types"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"

const hintSuggestions = [
  { label: "Connect an image source" },
  { label: "Add motion prompt" },
]

export const VideoGenNodeComponent = React.memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as VideoGenNodeData
  const nodes = useNodes()
  const edges = useEdges()
  const reactFlow = useReactFlow()
  const nodeCounterRef = React.useRef(Date.now())
  const [isHovered, setIsHovered] = React.useState(false)
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [title, setTitle] = React.useState(nodeData.label || "Video")
  const titleInputRef = React.useRef<HTMLInputElement>(null)
  const [isFullscreenOpen, setIsFullscreenOpen] = React.useState(false)
  const [isAddMediaOpen, setIsAddMediaOpen] = React.useState(false)
  const imageUploadRef = React.useRef<HTMLInputElement>(null)
  const videoUploadRef = React.useRef<HTMLInputElement>(null)
  const [videoDuration, setVideoDuration] = React.useState<number | null>(null)
  const [isExtractingFrame, setIsExtractingFrame] = React.useState(false)

  // Helper function to get video duration
  const getVideoDuration = (url: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      
      video.onloadedmetadata = () => {
        resolve(video.duration)
      }
      
      video.onerror = () => {
        reject(new Error('Failed to load video metadata'))
      }
      
      video.src = url
    })
  }

  // Track connected image and video nodes
  React.useEffect(() => {
    const currentNode = nodes.find(n => n.id === id)
    if (!currentNode) return

    const incomingNodes = getIncomers(currentNode, nodes, edges)
    
    // Get image from upload or image-gen nodes (use first one found)
    let imageUrl: string | null = null
    for (const node of incomingNodes) {
      if (node.type === 'upload') {
        const uploadData = node.data as any
        if (uploadData.fileUrl && uploadData.fileType === 'image') {
          imageUrl = uploadData.fileUrl
          break
        }
      } else if (node.type === 'image-gen') {
        const imageGenData = node.data as any
        if (imageGenData.generatedImageUrl) {
          imageUrl = imageGenData.generatedImageUrl
          break
        }
      }
    }
    
    // Get video from upload nodes (use first one found)
    let videoUrl: string | null = null
    for (const node of incomingNodes) {
      if (node.type === 'upload') {
        const uploadData = node.data as any
        if (uploadData.fileUrl && uploadData.fileType === 'video') {
          videoUrl = uploadData.fileUrl
          break
        }
      }
    }
    
    // Update connected URLs if changed
    if (imageUrl !== nodeData.connectedImageUrl) {
      nodeData.onDataChange?.(id, { connectedImageUrl: imageUrl })
    }
    if (videoUrl !== nodeData.connectedVideoUrl) {
      nodeData.onDataChange?.(id, { connectedVideoUrl: videoUrl })
    }
  }, [nodes, edges, id, nodeData])

  // Update video duration when video changes
  React.useEffect(() => {
    const finalVideoUrl = nodeData.manualVideoUrl || nodeData.connectedVideoUrl
    if (finalVideoUrl) {
      getVideoDuration(finalVideoUrl)
        .then(duration => setVideoDuration(duration))
        .catch(() => setVideoDuration(null))
    } else {
      setVideoDuration(null)
    }
  }, [nodeData.manualVideoUrl, nodeData.connectedVideoUrl])

  React.useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  // Adjust node size based on video aspect ratio when video is generated
  React.useEffect(() => {
    const videoUrl = nodeData.generatedVideoUrl
    if (videoUrl) {
      // Extract first frame to get dimensions
      extractFirstFrame(videoUrl, 'temp')
        .then((frame) => {
          const aspectRatio = frame.width / frame.height
          const maxWidth = 500
          const maxHeight = 500
          const minWidth = 200
          const minHeight = 200
          
          let nodeWidth: number
          let nodeHeight: number
          
          if (aspectRatio > 1) {
            // Landscape
            nodeWidth = Math.min(maxWidth, Math.max(minWidth, 350))
            nodeHeight = nodeWidth / aspectRatio
            if (nodeHeight < minHeight) {
              nodeHeight = minHeight
              nodeWidth = nodeHeight * aspectRatio
            }
          } else {
            // Portrait or square
            nodeHeight = Math.min(maxHeight, Math.max(minHeight, 350))
            nodeWidth = nodeHeight * aspectRatio
            if (nodeWidth < minWidth) {
              nodeWidth = minWidth
              nodeHeight = nodeWidth / aspectRatio
            }
          }
          
          reactFlow.updateNode(id, {
            style: {
              width: nodeWidth,
              height: nodeHeight,
            },
          })
          
          // Clean up the temporary blob URL
          URL.revokeObjectURL(frame.url)
        })
        .catch((error) => {
          console.error('Error extracting frame for dimensions:', error)
          // Reset to default size on error
          reactFlow.updateNode(id, {
            style: {
              width: 280,
              height: 280,
            },
          })
        })
    } else {
      // Reset to default size when no video
      reactFlow.updateNode(id, {
        style: {
          width: 280,
          height: 280,
        },
      })
    }
  }, [nodeData.generatedVideoUrl, id, reactFlow])

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
      setTitle(nodeData.label || "Video")
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleTitleBlur()
    } else if (e.key === "Escape") {
      setIsEditingTitle(false)
      setTitle(nodeData.label || "Video")
    }
  }

  const handleDownload = async () => {
    if (!nodeData.generatedVideoUrl) return

    try {
      const response = await fetch(nodeData.generatedVideoUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `${title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.mp4`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch (error) {
      console.error('Error downloading video:', error)
    }
  }

  const handleSendToChat = () => {
    if (!nodeData.generatedVideoUrl) return
    
    const event = new CustomEvent('chat-add-asset', {
      detail: { url: nodeData.generatedVideoUrl, type: 'video' }
    })
    window.dispatchEvent(event)
    
    const openChatEvent = new CustomEvent('chat-open')
    window.dispatchEvent(openChatEvent)
  }

  const handleFullscreen = () => {
    if (nodeData.generatedVideoUrl) {
      setIsFullscreenOpen(true)
    }
  }

  const handleExtractFirstFrame = async () => {
    const videoUrl = nodeData.generatedVideoUrl
    if (!videoUrl) return
    
    setIsExtractingFrame(true)
    try {
      const frame = await extractFirstFrame(videoUrl, title.replace(/\s+/g, '-').toLowerCase())

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
    } catch (error) {
      console.error('Error extracting first frame:', error)
    } finally {
      setIsExtractingFrame(false)
    }
  }

  const handleExtractLastFrame = async () => {
    const videoUrl = nodeData.generatedVideoUrl
    if (!videoUrl) return
    
    setIsExtractingFrame(true)
    try {
      const frame = await extractLastFrame(videoUrl, title.replace(/\s+/g, '-').toLowerCase())

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
    } catch (error) {
      console.error('Error extracting last frame:', error)
    } finally {
      setIsExtractingFrame(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith("image/")) return

    const url = URL.createObjectURL(file)
    nodeData.onDataChange?.(id, { 
      manualImageUrl: url, 
      manualImageFile: file, // Store file for upload
      error: null 
    })
    
    if (imageUploadRef.current) imageUploadRef.current.value = ""
    setIsAddMediaOpen(false)
  }

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith("video/")) return

    try {
      // Check duration first
      const url = URL.createObjectURL(file)
      const duration = await getVideoDuration(url)
      
      if (duration > 10) {
        nodeData.onDataChange?.(id, {
          error: `Video must be 10 seconds or less. Your video is ${duration.toFixed(1)}s.`
        })
        URL.revokeObjectURL(url)
        if (videoUploadRef.current) videoUploadRef.current.value = ""
        setIsAddMediaOpen(false)
        return
      }

      nodeData.onDataChange?.(id, { 
        manualVideoUrl: url, 
        manualVideoFile: file, // Store file for upload
        error: null 
      })
      
      if (videoUploadRef.current) videoUploadRef.current.value = ""
      setIsAddMediaOpen(false)
    } catch (error) {
      nodeData.onDataChange?.(id, {
        error: "Failed to validate video. Please try again."
      })
      if (videoUploadRef.current) videoUploadRef.current.value = ""
      setIsAddMediaOpen(false)
    }
  }

  const handleRemoveImage = () => {
    nodeData.onDataChange?.(id, { manualImageUrl: null, manualImageFile: null })
  }

  const handleRemoveVideo = () => {
    nodeData.onDataChange?.(id, { manualVideoUrl: null, manualVideoFile: null })
  }

  const handleGenerate = async () => {
    // Get final image and video URLs (prefer manual, fallback to connected)
    const finalImageUrl = nodeData.manualImageUrl || nodeData.connectedImageUrl
    const finalVideoUrl = nodeData.manualVideoUrl || nodeData.connectedVideoUrl

    if (!finalImageUrl || !finalVideoUrl) {
      nodeData.onDataChange?.(id, {
        error: "Both image and video inputs are required",
      })
      return
    }

    nodeData.onDataChange?.(id, { isGenerating: true, error: null })

    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        throw new Error('Please log in to generate videos')
      }

      let imagePublicUrl: string
      let imageStoragePath: string
      let videoPublicUrl: string
      let videoStoragePath: string

      // Upload image to Supabase
      if (nodeData.manualImageFile) {
        // Manual upload - use the stored File
        const imageExtension = nodeData.manualImageFile.name.split('.').pop() || 'png'
        const imageTimestamp = Date.now()
        const imageRandomStr = Math.random().toString(36).substring(7)
        const imageFilename = `${imageTimestamp}-${imageRandomStr}.${imageExtension}`
        imageStoragePath = `${user.id}/video-gen-images/${imageFilename}`

        const { error: imageUploadError } = await supabase.storage
          .from('public-bucket')
          .upload(imageStoragePath, nodeData.manualImageFile, {
            contentType: nodeData.manualImageFile.type,
            upsert: false,
          })

        if (imageUploadError) {
          throw new Error(`Failed to upload image: ${imageUploadError.message}`)
        }

        const { data: imageUrlData } = supabase.storage
          .from('public-bucket')
          .getPublicUrl(imageStoragePath)
        imagePublicUrl = imageUrlData.publicUrl
      } else {
        // Connected node - fetch and upload
        const imageResponse = await fetch(finalImageUrl)
        const imageBlob = await imageResponse.blob()
        const imageExtension = imageBlob.type.split('/')[1] || 'png'
        const imageTimestamp = Date.now()
        const imageRandomStr = Math.random().toString(36).substring(7)
        const imageFilename = `${imageTimestamp}-${imageRandomStr}.${imageExtension}`
        imageStoragePath = `${user.id}/video-gen-images/${imageFilename}`

        const { error: imageUploadError } = await supabase.storage
          .from('public-bucket')
          .upload(imageStoragePath, imageBlob, {
            contentType: imageBlob.type,
            upsert: false,
          })

        if (imageUploadError) {
          throw new Error(`Failed to upload image: ${imageUploadError.message}`)
        }

        const { data: imageUrlData } = supabase.storage
          .from('public-bucket')
          .getPublicUrl(imageStoragePath)
        imagePublicUrl = imageUrlData.publicUrl
      }

      // Upload video to Supabase
      if (nodeData.manualVideoFile) {
        // Manual upload - use the stored File
        const videoExtension = nodeData.manualVideoFile.name.split('.').pop() || 'mp4'
        const videoTimestamp = Date.now()
        const videoRandomStr = Math.random().toString(36).substring(7)
        const videoFilename = `${videoTimestamp}-${videoRandomStr}.${videoExtension}`
        videoStoragePath = `${user.id}/video-gen-videos/${videoFilename}`

        const { error: videoUploadError } = await supabase.storage
          .from('public-bucket')
          .upload(videoStoragePath, nodeData.manualVideoFile, {
            contentType: nodeData.manualVideoFile.type,
            upsert: false,
          })

        if (videoUploadError) {
          throw new Error(`Failed to upload video: ${videoUploadError.message}`)
        }

        const { data: videoUrlData } = supabase.storage
          .from('public-bucket')
          .getPublicUrl(videoStoragePath)
        videoPublicUrl = videoUrlData.publicUrl
      } else {
        // Connected node - fetch and upload
        const videoResponse = await fetch(finalVideoUrl)
        const videoBlob = await videoResponse.blob()
        const videoExtension = videoBlob.type.split('/')[1] || 'mp4'
        const videoTimestamp = Date.now()
        const videoRandomStr = Math.random().toString(36).substring(7)
        const videoFilename = `${videoTimestamp}-${videoRandomStr}.${videoExtension}`
        videoStoragePath = `${user.id}/video-gen-videos/${videoFilename}`

        const { error: videoUploadError } = await supabase.storage
          .from('public-bucket')
          .upload(videoStoragePath, videoBlob, {
            contentType: videoBlob.type,
            upsert: false,
          })

        if (videoUploadError) {
          throw new Error(`Failed to upload video: ${videoUploadError.message}`)
        }

        const { data: videoUrlData } = supabase.storage
          .from('public-bucket')
          .getPublicUrl(videoStoragePath)
        videoPublicUrl = videoUrlData.publicUrl
      }

      // Send URLs to API (like motion copy page)
      const response = await fetch("/api/generate-video", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: imagePublicUrl,
          videoUrl: videoPublicUrl,
          imageStoragePath,
          videoStoragePath,
          prompt: nodeData.prompt || "",
          mode: nodeData.mode,
          keep_original_sound: true,
          character_orientation: 'image',
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || err.message || "Failed to generate video")
      }

      const result = await response.json()
      if (!result.video?.url) throw new Error("No video URL received")

      nodeData.onDataChange?.(id, {
        generatedVideoUrl: result.video.url,
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

  const hasContent = !!nodeData.generatedVideoUrl

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
          
          {/* Input status indicators */}
          <div className="flex items-center gap-2 text-[10px] px-1">
            <span className={cn(nodeData.imageUrl ? "text-blue-400" : "text-zinc-500")}>
              Image {nodeData.imageUrl ? "✓" : "—"}
            </span>
            <span className={cn(nodeData.videoUrl ? "text-blue-400" : "text-zinc-500")}>
              Video {nodeData.videoUrl ? "✓" : "—"}
            </span>
          </div>

          <div className="w-px h-5 bg-white/10" />

          {/* Frame extraction buttons */}
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
            className="text-xs font-medium text-blue-400 uppercase tracking-wider bg-transparent border border-blue-500/40 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-500/40"
          />
        ) : (
          <span 
            className={cn(
              "text-xs font-medium text-blue-400 uppercase tracking-wider",
              selected && "cursor-pointer hover:text-blue-300 transition-colors"
            )}
          >
            {title}
          </span>
        )}
      </div>

      {/* Wrapper to allow handles to overflow */}
      <div 
        className="relative w-full h-full"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className={cn(
            "relative transition-all duration-200 w-full h-full",
            hasContent
              ? "rounded-lg overflow-hidden"
              : "rounded-xl border bg-zinc-900 shadow-lg flex flex-col",
            !hasContent && selected
              ? "border-blue-500/40 ring-1 ring-blue-500/20"
              : !hasContent && "border-white/10 hover:border-white/20",
            hasContent && selected && "ring-2 ring-blue-500/40"
          )}
        >

          {/* Content area: hints OR generated preview */}
          {hasContent ? (
            <div className="relative w-full h-full">
              <video
                src={nodeData.generatedVideoUrl!}
                controls
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="px-3 py-3">
              <div className="py-2 space-y-1.5">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Try to:</p>
                {hintSuggestions.map((hint) => (
                  <div key={hint.label} className="flex items-center gap-2 text-zinc-500">
                    <VideoCamera size={13} weight="duotone" className="text-blue-400/60" />
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
          <div className="w-6 h-6 rounded-full border-2 border-blue-500 bg-zinc-900 flex items-center justify-center cursor-crosshair hover:bg-blue-500/10 transition-colors">
            <Plus size={14} weight="bold" className="text-blue-500 pointer-events-none" />
            <Handle
              id="input"
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
        <div className="w-6 h-6 rounded-full border-2 border-blue-500 bg-zinc-900 flex items-center justify-center cursor-crosshair hover:bg-blue-500/10 transition-colors">
          <Plus size={14} weight="bold" className="text-blue-500 pointer-events-none" />
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
        {/* Prompt input area */}
        <div className="p-2.5 space-y-2">
          {/* Media previews */}
          {(() => {
            const finalImageUrl = nodeData.manualImageUrl || nodeData.connectedImageUrl
            const finalVideoUrl = nodeData.manualVideoUrl || nodeData.connectedVideoUrl
            const hasMedia = finalImageUrl || finalVideoUrl
            
            if (hasMedia) {
              return (
                <div className="flex gap-2 mb-2">
                  {/* Image preview */}
                  {finalImageUrl && (
                    <div className="relative rounded-lg overflow-hidden border border-white/10 group" style={{ width: '120px', height: '80px' }}>
                      <img 
                        src={finalImageUrl} 
                        alt="Image input"
                        className="w-full h-full object-cover bg-black/20"
                      />
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-zinc-900/80 text-[9px] text-zinc-400">
                        Image
                      </div>
                      {nodeData.manualImageUrl && (
                        <button
                          onClick={handleRemoveImage}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remove image"
                        >
                          <X size={12} className="text-white" />
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* Video preview */}
                  {finalVideoUrl && (
                    <div className="relative rounded-lg overflow-hidden border border-white/10 group" style={{ width: '120px', height: '80px' }}>
                      <video 
                        src={finalVideoUrl} 
                        className="w-full h-full object-cover bg-black/20"
                      />
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-zinc-900/80 text-[9px] text-zinc-400">
                        Video
                      </div>
                      {videoDuration !== null && (
                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-zinc-900/80 text-[9px] text-zinc-200 font-mono">
                          {videoDuration.toFixed(1)}s
                        </div>
                      )}
                      {nodeData.manualVideoUrl && (
                        <button
                          onClick={handleRemoveVideo}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remove video"
                        >
                          <X size={12} className="text-white" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            }
            return null
          })()}

          <textarea
            value={nodeData.prompt || ""}
            onChange={(e) => nodeData.onDataChange?.(id, { prompt: e.target.value })}
            placeholder="Describe the motion..."
            rows={2}
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

        {/* Bottom bar: mode toggle + generate */}
        <div className="border-t border-white/5 px-3 py-2.5 flex flex-nowrap items-center gap-2 overflow-x-auto">
          {/* Add Media Button with Dropdown */}
          <DropdownMenu open={isAddMediaOpen} onOpenChange={setIsAddMediaOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                title="Add image or video"
              >
                <Plus size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="nopan nodrag">
              <DropdownMenuItem 
                onClick={() => imageUploadRef.current?.click()}
                disabled={!!(nodeData.manualImageUrl || nodeData.connectedImageUrl)}
              >
                <ImageIcon size={14} className="mr-2" />
                Upload Image {(nodeData.manualImageUrl || nodeData.connectedImageUrl) && '✓'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => videoUploadRef.current?.click()}
                disabled={!!(nodeData.manualVideoUrl || nodeData.connectedVideoUrl)}
              >
                <VideoCamera size={14} className="mr-2" />
                Upload Video {(nodeData.manualVideoUrl || nodeData.connectedVideoUrl) && '✓'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Hidden file inputs */}
          <input
            ref={imageUploadRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <input
            ref={videoUploadRef}
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            className="hidden"
          />

          <ToggleGroup
            type="single"
            value={nodeData.mode || "std"}
            onValueChange={(value) => {
              if (value) nodeData.onDataChange?.(id, { mode: value as "pro" | "std" })
            }}
            className="gap-1"
          >
            <ToggleGroupItem value="pro" className="h-7 px-2 text-[11px] data-[state=on]:bg-blue-500 data-[state=on]:text-white">
              Pro
            </ToggleGroupItem>
            <ToggleGroupItem value="std" className="h-7 px-2 text-[11px] data-[state=on]:bg-blue-500 data-[state=on]:text-white">
              Standard
            </ToggleGroupItem>
          </ToggleGroup>

          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
            Kling v2.6
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
    {nodeData.generatedVideoUrl && (
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
            <video
              src={nodeData.generatedVideoUrl}
              controls
              autoPlay
              className="w-auto h-auto max-w-[96vw] max-h-[96vh] min-w-[60vw] min-h-[60vh] object-contain pointer-events-auto"
            />
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  )
})

VideoGenNodeComponent.displayName = 'VideoGenNodeComponent'

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
