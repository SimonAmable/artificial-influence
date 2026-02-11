"use client"

import * as React from "react"
import { Handle, Position, NodeToolbar, type NodeProps, useReactFlow, useNodes, useEdges, getIncomers, useUpdateNodeInternals, useStore } from "@xyflow/react"
import {
  Image as ImageIcon,
  CircleNotch,
  Play,
  ArrowClockwise,
  ArrowsOut,
  DownloadSimple,
  Crop,
  Plus,
  MagicWand,
  X,
  Check,
  Upload,
  DotsSixVertical,
  PaperPlaneTilt,
  PencilSimple,
  CaretLeft,
  CaretRight,
  FloppyDisk,
} from "@phosphor-icons/react"
import { AnimatePresence, motion } from "framer-motion"
import Cropper, { type Area } from "react-easy-crop"
import type { ImageGenNodeData, TextNodeData, UploadNodeData } from "@/lib/canvas/types"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { useModels } from "@/hooks/use-models"
import { ModelIcon } from "@/components/shared/icons/model-icon"
import { uploadFilesToSupabase } from "@/lib/canvas/upload-helpers"
import { toast } from "sonner"
import { createNodeDragHandler } from "@/lib/canvas/drag-utils"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { getConstrainedSize, loadImageSize } from "@/lib/canvas/media-sizing"
import { ImageEditorDialog } from "@/components/image-editor"
import { CreateAssetDialog } from "@/components/canvas/create-asset-dialog"

// Helper function to get dimensions for aspect ratio
const getImageDimensions = (aspectRatio: string) => {
  const baseSize = 280 // Base width for square
  const ratios: Record<string, [number, number]> = {
    "match_input_image": [baseSize, baseSize], // Default to square when no input
    "1:1": [baseSize, baseSize],
    "16:9": [baseSize, Math.round((baseSize * 9) / 16)],
    "9:16": [Math.round((baseSize * 9) / 16), baseSize],
    "4:3": [baseSize, Math.round((baseSize * 3) / 4)],
    "3:4": [Math.round((baseSize * 3) / 4), baseSize],
    "3:2": [baseSize, Math.round((baseSize * 2) / 3)],
    "2:3": [Math.round((baseSize * 2) / 3), baseSize],
  }
  return ratios[aspectRatio] || [baseSize, baseSize]
}

const MAX_GENERATED_IMAGES = 20

function getNormalizedGeneratedImages(data: ImageGenNodeData): {
  urls: string[]
  activeIndex: number
  activeUrl: string | null
} {
  const rawUrls = Array.isArray(data.generatedImageUrls)
    ? data.generatedImageUrls.filter((url): url is string => typeof url === "string" && url.length > 0)
    : []
  const legacyFallback =
    typeof data.generatedImageUrl === "string" && data.generatedImageUrl.length > 0
      ? [data.generatedImageUrl]
      : []
  const urls = (rawUrls.length > 0 ? rawUrls : legacyFallback).slice(-MAX_GENERATED_IMAGES)
  const rawActiveIndex = data.activeImageIndex
  const requestedIndex =
    typeof rawActiveIndex === "number" && Number.isFinite(rawActiveIndex)
      ? Math.floor(rawActiveIndex)
      : 0
  const activeIndex = urls.length === 0 ? 0 : Math.min(Math.max(requestedIndex, 0), urls.length - 1)
  const activeUrl = urls[activeIndex] ?? null

  return { urls, activeIndex, activeUrl }
}

function getFirstAvailableImageUrl(data: ImageGenNodeData): string | null {
  const normalized = getNormalizedGeneratedImages(data)
  return normalized.activeUrl
}

export const ImageGenNodeComponent = React.memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as ImageGenNodeData
  const { models: imageModels } = useModels("image")
  const [width, height] = getImageDimensions(nodeData.aspectRatio || "match_input_image")
  const [isHovered, setIsHovered] = React.useState(false)
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [title, setTitle] = React.useState(nodeData.label || "image")
  const titleInputRef = React.useRef<HTMLInputElement>(null)
  const [isCropping, setIsCropping] = React.useState(false)
  const [isFullscreenOpen, setIsFullscreenOpen] = React.useState(false)
  const [isAddImageOpen, setIsAddImageOpen] = React.useState(false)
  const [isEditorOpen, setIsEditorOpen] = React.useState(false)
  const [isCreateAssetOpen, setIsCreateAssetOpen] = React.useState(false)
  const [isPromptExpanded, setIsPromptExpanded] = React.useState(false)
  const uploadInputRef = React.useRef<HTMLInputElement>(null)
  const [crop, setCrop] = React.useState({ x: 0, y: 0 })
  const [zoom, setZoom] = React.useState(1)
  const [cropAspect, setCropAspect] = React.useState<number>(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null)
  const [mediaSize, setMediaSize] = React.useState<{ width: number; height: number } | null>(null)
  const [previousViewport, setPreviousViewport] = React.useState<{ x: number; y: number; zoom: number } | null>(null)
  const reactFlow = useReactFlow()
  const { isConnecting, connectingFromId } = useStore((state) => ({
    isConnecting: state.connection.inProgress,
    connectingFromId: state.connection.fromHandle?.nodeId,
  }))
  const updateNodeInternals = useUpdateNodeInternals()
  const nodes = useNodes()
  const edges = useEdges()

  // Track connected text nodes and update connectedPrompt
  // Track connected image/upload nodes and update connectedImageUrls
  // Optimized: Only compute when edges change, not on every node position update
  const { connectedPrompt, connectedImageUrls } = React.useMemo(() => {
    const currentNode = nodes.find(n => n.id === id)
    if (!currentNode) return { connectedPrompt: '', connectedImageUrls: [] }

    const incomingNodes = getIncomers(currentNode, nodes, edges)
    
    // Get text from text nodes
    const textNodes = incomingNodes.filter(node => node.type === 'text')
    const combinedText = textNodes
      .map(node => (node.data as TextNodeData).text || '')
      .filter(text => text.trim())
      .join(' ')
    
    // Get all images from upload or image-gen nodes
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
        const imageUrl = getFirstAvailableImageUrl(imageGenData)
        if (imageUrl) {
          imageUrls.push(imageUrl)
        }
      }
    }
    
    return { connectedPrompt: combinedText, connectedImageUrls: imageUrls }
  }, [edges, id, nodes]) // Only depends on edges and id, not individual node data
  
  // Update node data only when computed values actually change
  React.useEffect(() => {
    if (connectedPrompt !== (nodeData.connectedPrompt || '')) {
      nodeData.onDataChange?.(id, { connectedPrompt })
    }
  }, [connectedPrompt, nodeData, id])
  
  React.useEffect(() => {
    const currentUrls = nodeData.connectedImageUrls || []
    if (JSON.stringify(connectedImageUrls) !== JSON.stringify(currentUrls)) {
      nodeData.onDataChange?.(id, { connectedImageUrls })
    }
  }, [connectedImageUrls, nodeData, id])

  const generatedImages = getNormalizedGeneratedImages(nodeData)
  const generatedImageUrls = generatedImages.urls
  const activeImageIndex = generatedImages.activeIndex
  const activeImageUrl = generatedImages.activeUrl

  React.useEffect(() => {
    const updates: Partial<ImageGenNodeData> = {}
    const currentUrls = Array.isArray(nodeData.generatedImageUrls)
      ? nodeData.generatedImageUrls.filter((url): url is string => typeof url === "string" && url.length > 0)
      : []
    if (JSON.stringify(currentUrls) !== JSON.stringify(generatedImageUrls)) {
      updates.generatedImageUrls = generatedImageUrls
    }
    if ((nodeData.activeImageIndex ?? 0) !== activeImageIndex) {
      updates.activeImageIndex = activeImageIndex
    }
    if ((nodeData.generatedImageUrl ?? null) !== activeImageUrl) {
      updates.generatedImageUrl = activeImageUrl
    }
    if (Object.keys(updates).length > 0) {
      nodeData.onDataChange?.(id, updates)
    }
  }, [activeImageIndex, activeImageUrl, generatedImageUrls, id, nodeData])

  React.useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  const applyNodeSize = React.useCallback((width: number, height: number) => {
    const existing = reactFlow.getNode(id)
    const existingWidth = existing?.style?.width ?? existing?.width
    const existingHeight = existing?.style?.height ?? existing?.height
    if (existingWidth === width && existingHeight === height) return

    reactFlow.updateNode(id, {
      width,
      height,
      style: { width, height },
    })
    updateNodeInternals(id)
  }, [id, reactFlow, updateNodeInternals])

  React.useEffect(() => {
    if (activeImageUrl) {
      loadImageSize(activeImageUrl)
        .then((size) => {
          const constrained = getConstrainedSize(size)
          applyNodeSize(constrained.width, constrained.height)
        })
        .catch(() => {
          // Ignore load errors; keep existing size
        })
      return
    }

    // Reset to aspect-ratio defaults when no media
    applyNodeSize(width, height)
  }, [activeImageUrl, applyNodeSize, width, height])

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
      setTitle(nodeData.label || "image")
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleTitleBlur()
    } else if (e.key === "Escape") {
      setIsEditingTitle(false)
      setTitle(nodeData.label || "image")
    }
  }

  const currentNode = reactFlow.getNode(id)
  const toNumber = (value: number | string | undefined) => {
    if (typeof value === 'number') return value
    if (typeof value === 'string') return Number.parseFloat(value)
    return undefined
  }
  const nodeWidth = toNumber(currentNode?.style?.width) ?? toNumber(currentNode?.width) ?? width
  const nodeHeight = toNumber(currentNode?.style?.height) ?? toNumber(currentNode?.height) ?? height

  const handleCrop = () => {
    if (activeImageUrl) {
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
            width: nodeWidth + padding * 2,
            height: nodeHeight + padding * 2,
          },
          { duration: 600 }
        )
      }
      
      // Set crop mode
      setTimeout(() => {
        setIsCropping(true)
        setCrop({ x: 0, y: 0 })
        setZoom(1)
        // Initialize crop aspect from node aspect ratio
        const aspectValue = nodeData.aspectRatio === "16:9" ? 16/9 :
                           nodeData.aspectRatio === "9:16" ? 9/16 :
                           nodeData.aspectRatio === "4:3" ? 4/3 :
                           nodeData.aspectRatio === "3:4" ? 3/4 :
                           nodeData.aspectRatio === "3:2" ? 3/2 :
                           nodeData.aspectRatio === "2:3" ? 2/3 :
                           nodeData.aspectRatio === "match_input_image" ? 0 : 1
        setCropAspect(aspectValue)
      }, 300)
    }
  }

  const handleCropCancel = () => {
    setIsCropping(false)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    
    // Restore previous viewport
    if (previousViewport) {
      reactFlow.setViewport(previousViewport, { duration: 600 })
      setPreviousViewport(null)
    }
  }

  const onCropComplete = React.useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const onMediaLoaded = React.useCallback((mediaSize: { width: number; height: number; naturalWidth: number; naturalHeight: number }) => {
    setMediaSize({ width: mediaSize.naturalWidth, height: mediaSize.naturalHeight })
  }, [])

  const handleCropConfirm = async () => {
    if (!croppedAreaPixels || !activeImageUrl) return

    try {
      const { getCroppedImg } = await import('@/lib/utils/crop-image')
      const croppedBlob = await getCroppedImg(activeImageUrl, croppedAreaPixels)
      const croppedUrl = URL.createObjectURL(croppedBlob)
      const updatedImageUrls = [...generatedImageUrls]
      if (updatedImageUrls.length === 0) {
        updatedImageUrls.push(croppedUrl)
      } else {
        updatedImageUrls[activeImageIndex] = croppedUrl
      }
      nodeData.onDataChange?.(id, {
        generatedImageUrls: updatedImageUrls,
        activeImageIndex,
        generatedImageUrl: updatedImageUrls[activeImageIndex] ?? null,
      })
      setIsCropping(false)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
      
      // Restore previous viewport
      if (previousViewport) {
        reactFlow.setViewport(previousViewport, { duration: 600 })
        setPreviousViewport(null)
      }
    } catch (error) {
      console.error('Error cropping image:', error)
    }
  }

  const handleDownload = async () => {
    if (!activeImageUrl) return

    try {
      // Fetch the image as a blob to handle remote URLs
      const response = await fetch(activeImageUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `${title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up the object URL
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch (error) {
      console.error('Error downloading image:', error)
    }
  }

  const handleManualImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const imageFiles = Array.from(files).filter(file => file.type.startsWith("image/"))
    if (imageFiles.length === 0) {
      toast.error("Please select image files only")
      return
    }

    // Upload to Supabase Storage
    const uploadResults = await uploadFilesToSupabase(imageFiles, 'reference-images')
    
    if (uploadResults.length > 0) {
      const currentManualImages = nodeData.manualImageUrls || []
      const newUrls = uploadResults.map(result => result.url)
      nodeData.onDataChange?.(id, {
        manualImageUrls: [...currentManualImages, ...newUrls]
      })
      toast.success(`Uploaded ${uploadResults.length} image${uploadResults.length > 1 ? 's' : ''}`)
    }
    
    if (uploadInputRef.current) uploadInputRef.current.value = ""
    setIsAddImageOpen(false)
  }

  const handleRemoveManualImage = (imageUrl: string) => {
    const currentManualImages = nodeData.manualImageUrls || []
    nodeData.onDataChange?.(id, {
      manualImageUrls: currentManualImages.filter(url => url !== imageUrl)
    })
  }

  const handleFullscreen = () => {
    if (activeImageUrl && !isCropping) {
      setIsFullscreenOpen(true)
    }
  }

  const handleSendToChat = () => {
    if (!activeImageUrl) return
    
    // Dispatch event to add image to chat
    const event = new CustomEvent('chat-add-asset', {
      detail: { url: activeImageUrl, type: 'image' }
    })
    window.dispatchEvent(event)
    
    // Open the chat
    const openChatEvent = new CustomEvent('chat-open')
    window.dispatchEvent(openChatEvent)
  }

  const handleWheel = React.useCallback((e: React.WheelEvent) => {
    if (isCropping) {
      e.stopPropagation()
      e.preventDefault()
      const delta = e.deltaY * -0.01
      const newZoom = Math.min(Math.max(zoom + delta, 1), 3)
      setZoom(newZoom)
    }
  }, [isCropping, zoom])

  // Block canvas zooming when in crop mode (except on the image node itself)
  React.useEffect(() => {
    if (isCropping) {
      const blockCanvasZoom = (e: Event) => {
        const wheelEvent = e as WheelEvent
        // Always prevent canvas zoom
        wheelEvent.preventDefault()
        wheelEvent.stopPropagation()
        
        // Check if the event originated from our image node
        const target = wheelEvent.target as HTMLElement
        const isOnImageNode = target.closest(`[data-id="${id}"]`)
        
        // If on image node, manually handle crop zoom
        if (isOnImageNode) {
          const delta = wheelEvent.deltaY * -0.01
          const newZoom = Math.min(Math.max(zoom + delta, 1), 3)
          setZoom(newZoom)
        }
      }
      
      // Add listener to the react-flow wrapper
      const reactFlowWrapper = document.querySelector('.react-flow')
      if (reactFlowWrapper) {
        reactFlowWrapper.addEventListener('wheel', blockCanvasZoom, { passive: false, capture: true })
      }
      
      return () => {
        if (reactFlowWrapper) {
          reactFlowWrapper.removeEventListener('wheel', blockCanvasZoom, { capture: true })
        }
      }
    }
  }, [isCropping, id, zoom])

  const cycleImage = React.useCallback((direction: -1 | 1) => {
    if (generatedImageUrls.length <= 1) return
    const nextIndex = (activeImageIndex + direction + generatedImageUrls.length) % generatedImageUrls.length
    nodeData.onDataChange?.(id, {
      activeImageIndex: nextIndex,
      generatedImageUrl: generatedImageUrls[nextIndex] ?? null,
    })
  }, [activeImageIndex, generatedImageUrls, id, nodeData])

  const handleGenerate = async () => {
    // Combine connected prompt and user prompt
    const fullPrompt = [nodeData.connectedPrompt, nodeData.prompt]
      .filter(p => p?.trim())
      .join(' ')
      .trim()

    if (!fullPrompt) {
      nodeData.onDataChange?.(id, { error: "Enter a prompt" })
      return
    }

    nodeData.onDataChange?.(id, { isGenerating: true, error: null })

    try {
      const formData = new FormData()
      formData.append("prompt", fullPrompt)
      formData.append("model", nodeData.model || "google/nano-banana")
      formData.append("enhancePrompt", String(nodeData.enhancePrompt))
      if (nodeData.aspectRatio) {
        formData.append("aspectRatio", nodeData.aspectRatio)
        formData.append("aspect_ratio", nodeData.aspectRatio)
      }

      // Add reference images if any connected or manual images exist
      const allReferenceImages = [
        ...(nodeData.connectedImageUrls || []),
        ...(nodeData.manualImageUrls || [])
      ]
      
      if (allReferenceImages.length > 0) {
        // Fetch and append all reference images
        for (let i = 0; i < allReferenceImages.length; i++) {
          const referenceImageUrl = allReferenceImages[i]
          try {
            // Fetch the image and convert to blob
            const imageResponse = await fetch(referenceImageUrl)
            const imageBlob = await imageResponse.blob()
            
            // Create a File from the blob with unique name
            const imageFile = new File([imageBlob], `reference-${i}.png`, { type: imageBlob.type })
            formData.append("referenceImages", imageFile)
          } catch (error) {
            console.error(`Error fetching reference image ${i}:`, error)
            // Continue with other reference images if one fails
          }
        }
      }

      formData.append("tool", "node")

      const { generateImageAndWait } = await import("@/lib/generate-image-client")
      const result = await generateImageAndWait(formData)
      const newImageUrls: string[] = []
      if (result.images?.length) {
        for (const image of result.images) {
          if (typeof image?.url === "string" && image.url.length > 0) newImageUrls.push(image.url)
        }
      } else if (typeof result.image?.url === "string" && result.image.url.length > 0) {
        newImageUrls.push(result.image.url)
      }
      if (newImageUrls.length === 0) throw new Error("No image URL received")

      const nextImageUrls = [...generatedImageUrls, ...newImageUrls].slice(-MAX_GENERATED_IMAGES)
      const nextActiveIndex = Math.max(0, nextImageUrls.length - newImageUrls.length)
      nodeData.onDataChange?.(id, {
        generatedImageUrls: nextImageUrls,
        activeImageIndex: nextActiveIndex,
        generatedImageUrl: nextImageUrls[nextActiveIndex] ?? null,
        isGenerating: false,
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed"
      if (message.includes("Insufficient credits")) {
        toast.error(message, {
          description: "Upgrade your plan to continue generating images",
          action: { label: "View Plans", onClick: () => window.open("/pricing", "_blank") }
        })
      }
      nodeData.onDataChange?.(id, { isGenerating: false, error: message })
    }
  }

  const hasContent = !!activeImageUrl

  return (
    <>
      {/* Floating toolbar using NodeToolbar */}
      <NodeToolbar
        isVisible={selected && hasContent && !isCropping}
        position={Position.Top}
        offset={35}
      >
        <div className="rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-md shadow-xl px-2 py-2 flex flex-nowrap items-center gap-2 overflow-x-auto nopan nodrag">
          <ToolbarIconButton icon={PaperPlaneTilt} onClick={handleSendToChat} label="Send to AI Chat" />
          <div className="w-px h-5 bg-white/10" />
          <ToolbarIconButton icon={PencilSimple} onClick={() => setIsEditorOpen(true)} label="Edit in Canvas" />
          <ToolbarIconButton icon={Crop} onClick={handleCrop} label="Crop" />
          <ToolbarIconButton icon={DownloadSimple} onClick={handleDownload} label="Download" />
          <ToolbarIconButton icon={FloppyDisk} onClick={() => setIsCreateAssetOpen(true)} label="Create Asset" />
          <ToolbarIconButton icon={ArrowsOut} onClick={handleFullscreen} label="Fullscreen" />
        </div>
      </NodeToolbar>

      {/* Crop Controls Toolbar */}
      <NodeToolbar
        isVisible={isCropping}
        position={Position.Top}
        offset={35}
      >
        <div className="rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-md shadow-xl px-3 py-2 flex flex-nowrap items-center gap-2 nopan nodrag">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Aspect</span>
            <Select
              value={cropAspect.toString()}
              onValueChange={(value) => setCropAspect(parseFloat(value))}
            >
              <SelectTrigger className="w-auto h-7 text-xs min-w-fit bg-zinc-800 border-zinc-700 px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1:1</SelectItem>
                <SelectItem value="1.7777777777777777">16:9</SelectItem>
                <SelectItem value="0.5625">9:16</SelectItem>
                <SelectItem value="1.3333333333333333">4:3</SelectItem>
                <SelectItem value="0.75">3:4</SelectItem>
                <SelectItem value="0">Match Input</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-24 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              title="Zoom level"
            />
            <span className="text-xs text-zinc-500 min-w-[32px]">{zoom.toFixed(1)}x</span>
          </div>
          <div className="w-px h-5 bg-white/10" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCropCancel}
            className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200"
          >
            <X size={14} className="mr-1" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCropConfirm}
            className="h-7 px-2 text-xs bg-purple-600 hover:bg-purple-500"
          >
            <Check size={14} className="mr-1" />
            Apply
          </Button>
        </div>
      </NodeToolbar>

      {/* Editable title above top left of card */}
      <div 
        className="absolute bottom-full mb-1.5 left-0 nopan nodrag flex items-center gap-1"
      >
        {/* Drag handle for dragging to AI chat */}
        {hasContent && (
          <div
            draggable
            onDragStart={createNodeDragHandler(id, 'image-gen', nodeData)}
            className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-purple-500/10 rounded transition-colors"
            title="Drag to AI chat"
          >
            <DotsSixVertical size={14} className="text-purple-400/60 hover:text-purple-400" weight="bold" />
          </div>
        )}
        
        <div onClick={handleTitleClick}>
          {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            className="text-xs font-medium text-purple-400 uppercase tracking-wider bg-transparent border border-purple-500/40 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-purple-500/40"
          />
        ) : (
          <span 
            className={cn(
              "text-xs font-medium text-purple-400 uppercase tracking-wider",
              selected && "cursor-pointer hover:text-purple-300 transition-colors"
            )}
          >
            {title}
          </span>
        )}
        </div>
      </div>

      {/* Wrapper to allow handles to overflow */}
      <div 
        className={cn(
          "relative",
          isCropping && "nodrag nopan",
          isConnecting && connectingFromId !== id && "easy-connect-glow"
        )}
        style={{ width: `${nodeWidth}px`, height: `${nodeHeight}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onWheel={handleWheel}
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
            hasContent || nodeData.isGenerating
              ? "rounded-lg overflow-hidden"
              : "rounded-xl border bg-zinc-900 shadow-lg flex flex-col",
            !hasContent && !nodeData.isGenerating && selected
              ? "border-purple-500/40 ring-1 ring-purple-500/20"
              : !hasContent && !nodeData.isGenerating && "border-white/10 hover:border-white/20",
            (hasContent || nodeData.isGenerating) && selected && "ring-2 ring-purple-500/40",
            isCropping && "nopan"
          )}
        >

          {/* Content area: loading state, hints, OR generated preview */}
          {nodeData.isGenerating ? (
            <div className="relative w-full h-full overflow-hidden bg-zinc-900">
              {/* Progress fill */}
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-zinc-800 to-zinc-700"
                style={{
                  width: '0%',
                  animation: 'fillProgress 20s linear infinite',
                  boxShadow: '2px 0 8px 0 rgba(255, 255, 255, 0.4)'
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
          ) : hasContent ? (
            <div className="relative w-full h-full">
              {isCropping ? (
                <div 
                  className="w-full h-full"
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseMove={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerMove={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                >
                  <Cropper
                    image={activeImageUrl!}
                    crop={crop}
                    zoom={zoom}
                    aspect={cropAspect === 0 ? undefined : cropAspect}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                    onMediaLoaded={onMediaLoaded}
                    restrictPosition={true}
                    showGrid={true}
                    cropShape="rect"
                    objectFit="vertical-cover"
                    style={{
                      containerStyle: {
                        width: '100%',
                        height: '100%',
                        borderRadius: '0.5rem',
                        backgroundColor: '#000',
                      },
                    }}
                  />
                </div>
              ) : (
                <img
                  src={activeImageUrl!}
                  alt="Generated"
                  className="w-full h-full object-cover"
                />
              )}
              {!isCropping && generatedImageUrls.length > 1 && (
                <div
                  className={cn(
                    "absolute inset-0 flex items-center justify-between px-2 transition-opacity",
                    isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
                  )}
                >
                  <button
                    type="button"
                    className="h-7 w-7 rounded-full border border-white/20 bg-zinc-900/80 text-white flex items-center justify-center hover:bg-zinc-800/80 nopan nodrag"
                    onClick={(e) => {
                      e.stopPropagation()
                      cycleImage(-1)
                    }}
                    aria-label="Previous image"
                    title="Previous image"
                  >
                    <CaretLeft size={14} weight="bold" />
                  </button>
                  <button
                    type="button"
                    className="h-7 w-7 rounded-full border border-white/20 bg-zinc-900/80 text-white flex items-center justify-center hover:bg-zinc-800/80 nopan nodrag"
                    onClick={(e) => {
                      e.stopPropagation()
                      cycleImage(1)
                    }}
                    aria-label="Next image"
                    title="Next image"
                  >
                    <CaretRight size={14} weight="bold" />
                  </button>
                  <div className="absolute top-2 right-2 rounded-full border border-white/20 bg-zinc-900/75 px-2 py-0.5 text-[10px] text-white">
                    {activeImageIndex + 1} / {generatedImageUrls.length}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full px-4 flex items-center justify-center">
              <p className="text-xs text-zinc-500 text-center leading-relaxed max-w-[220px]">
                Describe the image you want, then click Generate. Optionally connect text or image references.
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
          <div className="w-6 h-6 rounded-full border-2 border-purple-500 bg-zinc-900 flex items-center justify-center cursor-crosshair hover:bg-purple-500/10 transition-colors">
            <Plus size={14} weight="bold" className="text-purple-500 pointer-events-none" />
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
      >          <div className="w-6 h-6 rounded-full border-2 border-purple-500 bg-zinc-900 flex items-center justify-center cursor-crosshair hover:bg-purple-500/10 transition-colors">
            <Plus size={14} weight="bold" className="text-purple-500 pointer-events-none" />
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
      isVisible={selected && !isCropping}
      position={Position.Bottom}
      offset={12}
    >
      <div className="rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-md shadow-xl overflow-hidden nopan nodrag" style={{ width: '600px' }}>
        {/* Prompt input area */}
        <div className="p-2.5 space-y-2">

          <div className="relative">
            {/* Combined image previews - both connected and manual */}
            {(() => {
              const allImages = [
                ...(nodeData.connectedImageUrls || []),
                ...(nodeData.manualImageUrls || [])
              ]
              
              if (allImages.length > 0) {
                return (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {allImages.map((imageUrl, index) => {
                      const isManual = index >= (nodeData.connectedImageUrls || []).length
                      return (
                        <div 
                          key={`${imageUrl}-${index}`} 
                          className="relative rounded-lg overflow-hidden border border-white/10 group bg-black/20"
                          style={{ maxWidth: '120px', maxHeight: '120px' }}
                        >
                          <img 
                            src={imageUrl} 
                            alt={`Reference ${index + 1}`}
                            className="w-full h-full object-contain"
                          />
                          {isManual && (
                            <button
                              onClick={() => handleRemoveManualImage(imageUrl)}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Remove image"
                            >
                              <X size={12} className="text-white" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              }
              return null
            })()}
            
            {nodeData.connectedPrompt && (
              <div className="mb-2">
                <div 
                  className={cn(
                    "relative overflow-hidden transition-all duration-200 cursor-pointer hover:bg-zinc-800/30 rounded-lg p-2",
                    !isPromptExpanded && "max-h-[60px]"
                  )}
                  onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                >
                  <div className={cn(
                    "text-sm text-zinc-500 italic",
                    !isPromptExpanded && "line-clamp-2"
                  )}>
                    {nodeData.connectedPrompt}
                  </div>
                  {!isPromptExpanded && (
                    <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-zinc-900/95 to-transparent pointer-events-none" />
                  )}
                </div>
                {isPromptExpanded && (
                  <div className="text-xs text-zinc-600 mt-1 px-2">
                    Click to collapse
                  </div>
                )}
              </div>
            )}
            
            <textarea
              value={nodeData.prompt || ""}
              onChange={(e) => nodeData.onDataChange?.(id, { prompt: e.target.value })}
              placeholder={nodeData.connectedPrompt ? "Add more to the prompt..." : "Type a prompt or press '/' for commands..."}
              rows={2}
              className="w-full bg-transparent min-h-20 border-0 text-sm text-zinc-200 placeholder:text-zinc-600 resize-auto outline-none"
            />
          </div>

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

        {/* Bottom bar: model selectors + generate */}
        <div className=" px-3 py-2.5 flex flex-nowrap items-center gap-2 overflow-x-auto">
          {/* Add Image Button with Dropdown */}
          <DropdownMenu open={isAddImageOpen} onOpenChange={setIsAddImageOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                title="Add reference image"
              >
                <Plus size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="nopan nodrag">
              <DropdownMenuItem onClick={() => uploadInputRef.current?.click()}>
                <Upload size={14} className="mr-2" />
                Upload Image
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  // TODO: Implement asset selection
                  setIsAddImageOpen(false)
                }}
              >
                <ImageIcon size={14} className="mr-2" />
                Select Asset
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Hidden file input */}
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            onChange={handleManualImageUpload}
            className="hidden"
          />

          <Select
            value={nodeData.model || imageModels[0]?.identifier || "google/nano-banana"}
            onValueChange={(value) =>
              nodeData.onDataChange?.(id, { model: value })
            }
          >
            <SelectTrigger id="canvas-model-select" className="h-7 text-xs w-fit min-w-[100px]">
              <SelectValue placeholder="Select model">
                {nodeData.model && (() => {
                  const model = imageModels.find((m) => m.identifier === nodeData.model)
                  return (
                    <div className="flex items-center gap-1.5">
                      <ModelIcon identifier={nodeData.model} size={14} />
                      <span>{model?.name || nodeData.model}</span>
                    </div>
                  )
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" side="top" sideOffset={4}>
              {imageModels.map((model) => (
                <SelectItem key={model.identifier} value={model.identifier}>
                  <div className="flex items-center gap-2">
                    <div className="rounded-md border border-white/10 bg-white/5 p-1 shrink-0">
                      <ModelIcon identifier={model.identifier} size={16} />
                    </div>
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className="font-medium text-xs">{model.name}</span>
                      {model.description && (
                        <span className="text-[10px] text-zinc-400">
                          {model.description}
                        </span>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={nodeData.aspectRatio || "match_input_image"}
            onValueChange={(value) =>
              nodeData.onDataChange?.(id, { aspectRatio: value })
            }
          >
            <SelectTrigger className="h-7 text-xs w-fit min-w-[120px]">
              <SelectValue>
                {(nodeData.aspectRatio || "match_input_image") && (
                  <div className="flex items-center gap-2">
                    {(nodeData.aspectRatio || "match_input_image") === "match_input_image" ? (
                      <MagicWand weight="duotone" className="w-3 h-3" />
                    ) : (
                      <div
                        className={cn(
                          "border-2 border-foreground/60 rounded-[2px] shrink-0",
                          (nodeData.aspectRatio || "match_input_image") === "1:1" && "w-3 h-3",
                          (nodeData.aspectRatio || "match_input_image") === "16:9" && "w-3 h-2",
                          (nodeData.aspectRatio || "match_input_image") === "9:16" && "w-2 h-3",
                          (nodeData.aspectRatio || "match_input_image") === "4:3" && "w-3 h-2.5",
                          (nodeData.aspectRatio || "match_input_image") === "3:4" && "w-2.5 h-3",
                          (nodeData.aspectRatio || "match_input_image") === "3:2" && "w-3 h-2",
                          (nodeData.aspectRatio || "match_input_image") === "2:3" && "w-2 h-3"
                        )}
                      />
                    )}
                    <span>{(nodeData.aspectRatio || "match_input_image") === "match_input_image" ? "Auto" : nodeData.aspectRatio}</span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" side="top" sideOffset={4}>
              <SelectItem value="match_input_image">
                <div className="flex items-center gap-2">
                  <MagicWand weight="duotone" className="w-3 h-3" />
                  <span>Auto</span>
                </div>
              </SelectItem>
              <SelectItem value="1:1">
                <div className="flex items-center gap-2">
                  <div className="border-2 border-foreground/60 rounded-[2px] shrink-0 w-3 h-3" />
                  <span>1:1</span>
                </div>
              </SelectItem>
              <SelectItem value="16:9">
                <div className="flex items-center gap-2">
                  <div className="border-2 border-foreground/60 rounded-[2px] shrink-0 w-3 h-2" />
                  <span>16:9</span>
                </div>
              </SelectItem>
              <SelectItem value="9:16">
                <div className="flex items-center gap-2">
                  <div className="border-2 border-foreground/60 rounded-[2px] shrink-0 w-2 h-3" />
                  <span>9:16</span>
                </div>
              </SelectItem>
              <SelectItem value="4:3">
                <div className="flex items-center gap-2">
                  <div className="border-2 border-foreground/60 rounded-[2px] shrink-0 w-3 h-2.5" />
                  <span>4:3</span>
                </div>
              </SelectItem>
              <SelectItem value="3:4">
                <div className="flex items-center gap-2">
                  <div className="border-2 border-foreground/60 rounded-[2px] shrink-0 w-2.5 h-3" />
                  <span>3:4</span>
                </div>
              </SelectItem>
              <SelectItem value="3:2">
                <div className="flex items-center gap-2">
                  <div className="border-2 border-foreground/60 rounded-[2px] shrink-0 w-3 h-2" />
                  <span>3:2</span>
                </div>
              </SelectItem>
              <SelectItem value="2:3">
                <div className="flex items-center gap-2">
                  <div className="border-2 border-foreground/60 rounded-[2px] shrink-0 w-2 h-3" />
                  <span>2:3</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 px-1">
            <label className="text-xs text-zinc-400 cursor-pointer whitespace-nowrap">
              Enhance
            </label>
            <Switch
              checked={nodeData.enhancePrompt}
              onCheckedChange={(checked) =>
                nodeData.onDataChange?.(id, { enhancePrompt: checked })
              }
            />
          </div>

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

    {/* Fullscreen Dialog - Just for viewing */}
    {activeImageUrl && (
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
            <img
              src={activeImageUrl}
              alt={title}
              className="w-auto h-auto max-w-[96vw] max-h-[96vh] min-w-[60vw] min-h-[60vh] object-contain pointer-events-none"
            />
          </div>
        </DialogContent>
      </Dialog>
    )}

    {/* Image Editor Dialog */}
    <ImageEditorDialog
      open={isEditorOpen}
      onOpenChange={setIsEditorOpen}
      initialImage={activeImageUrl ?? undefined}
      onSave={(editedImageUrl) => {
        const updatedImageUrls = [...generatedImageUrls]
        if (updatedImageUrls.length === 0) {
          updatedImageUrls.push(editedImageUrl)
        } else {
          updatedImageUrls[activeImageIndex] = editedImageUrl
        }
        nodeData.onDataChange?.(id, {
          generatedImageUrls: updatedImageUrls,
          activeImageIndex,
          generatedImageUrl: updatedImageUrls[activeImageIndex] ?? null,
        })
        setIsEditorOpen(false)
      }}
    />

    {activeImageUrl && (
      <CreateAssetDialog
        open={isCreateAssetOpen}
        onOpenChange={setIsCreateAssetOpen}
        initial={{
          title,
          url: activeImageUrl,
          assetType: "image",
          sourceNodeType: "image-gen",
        }}
      />
    )}
    </>
  )
})

ImageGenNodeComponent.displayName = 'ImageGenNodeComponent'

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
