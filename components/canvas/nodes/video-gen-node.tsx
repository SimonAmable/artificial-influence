"use client"

import * as React from "react"
import { Handle, Position, NodeToolbar, type NodeProps, useNodes, useEdges, getIncomers, useReactFlow, useUpdateNodeInternals, type Node, useStore } from "@xyflow/react"
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
  FloppyDisk,
} from "@phosphor-icons/react"
import { motion } from "framer-motion"
import type { VideoGenNodeData, UploadNodeData, ImageGenNodeData } from "@/lib/canvas/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { extractFirstFrame, extractLastFrame } from "@/lib/canvas/frame-extraction"
import { createUploadNodeData } from "@/lib/canvas/types"
import { useModels } from "@/hooks/use-models"
import { buildVideoModelParameters } from "@/lib/utils/video-model-parameters"
import type { Model, ParameterDefinition } from "@/lib/types/models"
import { VideoPromptFields } from "@/components/tools/video/video-prompt-fields"
import { VideoModelParameterControls } from "@/components/tools/video/video-model-parameter-controls"
import { PhotoUpload, type ImageUpload } from "@/components/shared/upload/photo-upload"
import { VideoUpload } from "@/components/shared/upload/video-upload"
import { AudioUpload, type AudioUploadValue } from "@/components/shared/upload/audio-upload"
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
import { getConstrainedSize, loadVideoSize } from "@/lib/canvas/media-sizing"
import { uploadBlobToSupabase } from "@/lib/canvas/upload-helpers"
import { CreateAssetDialog } from "@/components/canvas/create-asset-dialog"

export const VideoGenNodeComponent = React.memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as VideoGenNodeData
  const nodes = useNodes()
  const edges = useEdges()
  const reactFlow = useReactFlow()
  const { isConnecting, connectingFromId } = useStore((state) => ({
    isConnecting: state.connection.inProgress,
    connectingFromId: state.connection.fromHandle?.nodeId,
  }))
  const updateNodeInternals = useUpdateNodeInternals()
  const nodeCounterRef = React.useRef(Date.now())
  const [isHovered, setIsHovered] = React.useState(false)
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [title, setTitle] = React.useState(nodeData.label || "Video")
  const titleInputRef = React.useRef<HTMLInputElement>(null)
  const [isFullscreenOpen, setIsFullscreenOpen] = React.useState(false)
  const [isAddMediaOpen, setIsAddMediaOpen] = React.useState(false)
  const [isCreateAssetOpen, setIsCreateAssetOpen] = React.useState(false)
  const imageUploadRef = React.useRef<HTMLInputElement>(null)
  const lastFrameUploadRef = React.useRef<HTMLInputElement>(null)
  const videoUploadRef = React.useRef<HTMLInputElement>(null)
  const audioUploadRef = React.useRef<HTMLInputElement>(null)
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
        const uploadData = node.data as UploadNodeData
        if (uploadData.fileUrl && uploadData.fileType === 'image') {
          imageUrl = uploadData.fileUrl
          break
        }
      } else if (node.type === 'image-gen') {
        const imageGenData = node.data as ImageGenNodeData
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
        const uploadData = node.data as UploadNodeData
        if (uploadData.fileUrl && uploadData.fileType === 'video') {
          videoUrl = uploadData.fileUrl
          break
        }
      }
    }

    // Get audio from upload nodes (use first one found)
    let audioUrl: string | null = null
    for (const node of incomingNodes) {
      if (node.type === 'upload') {
        const uploadData = node.data as UploadNodeData
        if (uploadData.fileUrl && uploadData.fileType === 'audio') {
          audioUrl = uploadData.fileUrl
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
    if (audioUrl !== nodeData.connectedAudioUrl) {
      nodeData.onDataChange?.(id, { connectedAudioUrl: audioUrl })
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

  const { models: videoModels } = useModels("video")

  const getModelFromIdentifier = React.useCallback(
    (identifier: string): Model | null => {
      const m = videoModels.find((x) => x.identifier === identifier) ?? videoModels[0]
      if (!m) return null
      return {
        ...m,
        parameters: { parameters: buildVideoModelParameters(m) },
      }
    },
    [videoModels]
  )

  const selectedModel = React.useMemo(() => {
    return getModelFromIdentifier(nodeData.model || "kwaivgi/kling-v2.6-motion-control")
  }, [getModelFromIdentifier, nodeData.model])

  React.useEffect(() => {
    if (!selectedModel) return
    if (nodeData.model !== selectedModel.identifier) {
      nodeData.onDataChange?.(id, { model: selectedModel.identifier })
    }
    if (!nodeData.parameters || Object.keys(nodeData.parameters).length === 0) {
      const defaults: Record<string, unknown> = {}
      selectedModel.parameters.parameters.forEach((param: ParameterDefinition) => {
        defaults[param.name] = param.default
      })
      nodeData.onDataChange?.(id, { parameters: defaults })
    }
  }, [id, nodeData, selectedModel])

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

  // Adjust node size based on video aspect ratio when video is generated
  React.useEffect(() => {
    const videoUrl = nodeData.generatedVideoUrl
    if (videoUrl) {
      loadVideoSize(videoUrl)
        .then((size) => {
          const constrained = getConstrainedSize(size)
          applyNodeSize(constrained.width, constrained.height)
        })
        .catch((error) => {
          console.error('Error loading video metadata for dimensions:', error)
          // Reset to default size on error
          applyNodeSize(280, 280)
        })
    } else {
      // Reset to default size when no video
      applyNodeSize(280, 280)
    }
  }, [nodeData.generatedVideoUrl, applyNodeSize])

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

  const handleLastFrameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith("image/")) return

    const url = URL.createObjectURL(file)
    nodeData.onDataChange?.(id, {
      manualLastFrameUrl: url,
      manualLastFrameFile: file,
      error: null,
    })

    if (lastFrameUploadRef.current) lastFrameUploadRef.current.value = ""
    setIsAddMediaOpen(false)
  }

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith("audio/")) return

    const url = URL.createObjectURL(file)
    nodeData.onDataChange?.(id, {
      manualAudioUrl: url,
      manualAudioFile: file,
      error: null,
    })

    if (audioUploadRef.current) audioUploadRef.current.value = ""
    setIsAddMediaOpen(false)
  }

  const handleRemoveImage = () => {
    nodeData.onDataChange?.(id, { manualImageUrl: null, manualImageFile: null })
  }

  const handleRemoveVideo = () => {
    nodeData.onDataChange?.(id, { manualVideoUrl: null, manualVideoFile: null })
  }

  const handleRemoveLastFrame = () => {
    nodeData.onDataChange?.(id, { manualLastFrameUrl: null, manualLastFrameFile: null })
  }

  const handleRemoveAudio = () => {
    nodeData.onDataChange?.(id, { manualAudioUrl: null, manualAudioFile: null })
  }

  const handleCustomImageChange = (image: ImageUpload | null) => {
    nodeData.onDataChange?.(id, {
      manualImageUrl: image?.url ?? null,
      manualImageFile: image?.file ?? null,
      error: null,
    })
  }

  const handleCustomVideoChange = (video: ImageUpload | null) => {
    nodeData.onDataChange?.(id, {
      manualVideoUrl: video?.url ?? null,
      manualVideoFile: video?.file ?? null,
      error: null,
    })
  }

  const handleCustomAudioChange = (audio: AudioUploadValue | null) => {
    nodeData.onDataChange?.(id, {
      manualAudioUrl: audio?.url ?? null,
      manualAudioFile: audio?.file ?? null,
      error: null,
    })
  }

  const handleGenerate = async () => {
    if (!selectedModel) {
      nodeData.onDataChange?.(id, { error: "Select a model first" })
      return
    }

    const modelIdentifier = selectedModel.identifier
    const isMotionCopy = modelIdentifier === "kwaivgi/kling-v2.6-motion-control"
    const isLipsync = modelIdentifier === "veed/fabric-1.0"

    const finalImageUrl = nodeData.manualImageUrl || nodeData.connectedImageUrl
    const finalVideoUrl = nodeData.manualVideoUrl || nodeData.connectedVideoUrl
    const finalAudioUrl = nodeData.manualAudioUrl || nodeData.connectedAudioUrl
    const finalLastFrameUrl = nodeData.manualLastFrameUrl || null

    const modelSupportsImage = selectedModel.parameters.parameters?.some(
      (param) =>
        param.name === "image" ||
        param.name === "first_frame_image" ||
        param.name === "start_image"
    )

    if (isMotionCopy && (!finalImageUrl || !finalVideoUrl)) {
      nodeData.onDataChange?.(id, { error: "Image and video are required" })
      return
    }
    if (isLipsync && (!finalImageUrl || !finalAudioUrl)) {
      nodeData.onDataChange?.(id, { error: "Image and audio are required" })
      return
    }
    if (!isMotionCopy && !isLipsync && modelSupportsImage && !finalImageUrl) {
      nodeData.onDataChange?.(id, { error: "Image input is required" })
      return
    }
    if (!isMotionCopy && !isLipsync && modelSupportsLastFrame && !finalLastFrameUrl) {
      nodeData.onDataChange?.(id, { error: "Last frame image is required" })
      return
    }
    if (!isMotionCopy && !isLipsync && !nodeData.prompt?.trim()) {
      nodeData.onDataChange?.(id, { error: "Prompt is required" })
      return
    }

    nodeData.onDataChange?.(id, { isGenerating: true, error: null })

    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        throw new Error("Please log in to generate videos")
      }

      const uploadFileToSupabase = async (file: File, prefix: string) => {
        const fileExtension = file.name.split(".").pop() || "bin"
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(7)
        const filename = `${timestamp}-${randomStr}.${fileExtension}`
        const storagePath = `${user.id}/${prefix}/${filename}`

        const { error: uploadError } = await supabase.storage
          .from("public-bucket")
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          })

        if (uploadError) {
          throw new Error(`Failed to upload file: ${uploadError.message}`)
        }

        const { data: urlData } = supabase.storage
          .from("public-bucket")
          .getPublicUrl(storagePath)

        return { url: urlData.publicUrl, storagePath }
      }

      const uploadUrlToSupabase = async (url: string, prefix: string) => {
        const response = await fetch(url)
        const blob = await response.blob()
        const extension = blob.type.split("/")[1] || "bin"
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(7)
        const filename = `${timestamp}-${randomStr}.${extension}`
        const storagePath = `${user.id}/${prefix}/${filename}`

        const { error: uploadError } = await supabase.storage
          .from("public-bucket")
          .upload(storagePath, blob, {
            contentType: blob.type,
            upsert: false,
          })

        if (uploadError) {
          throw new Error(`Failed to upload file: ${uploadError.message}`)
        }

        const { data: urlData } = supabase.storage
          .from("public-bucket")
          .getPublicUrl(storagePath)

        return { url: urlData.publicUrl, storagePath }
      }

      let imageUpload: { url: string; storagePath: string } | null = null
      let videoUpload: { url: string; storagePath: string } | null = null
      let audioUpload: { url: string; storagePath: string } | null = null

      if (finalImageUrl) {
        imageUpload = nodeData.manualImageFile
          ? await uploadFileToSupabase(nodeData.manualImageFile, "video-gen-images")
          : await uploadUrlToSupabase(finalImageUrl, "video-gen-images")
      }

      let lastFrameUpload: { url: string; storagePath: string } | null = null
      if (finalLastFrameUrl) {
        lastFrameUpload = nodeData.manualLastFrameFile
          ? await uploadFileToSupabase(nodeData.manualLastFrameFile, "video-gen-last-frames")
          : await uploadUrlToSupabase(finalLastFrameUrl, "video-gen-last-frames")
      }

      if (finalVideoUrl) {
        videoUpload = nodeData.manualVideoFile
          ? await uploadFileToSupabase(nodeData.manualVideoFile, "video-gen-videos")
          : await uploadUrlToSupabase(finalVideoUrl, "video-gen-videos")
      }

      if (finalAudioUrl) {
        audioUpload = nodeData.manualAudioFile
          ? await uploadFileToSupabase(nodeData.manualAudioFile, "video-gen-audio")
          : await uploadUrlToSupabase(finalAudioUrl, "video-gen-audio")
      }

      let response: Response

      if (isMotionCopy) {
        response = await fetch("/api/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: imageUpload?.url,
            videoUrl: videoUpload?.url,
            imageStoragePath: imageUpload?.storagePath,
            videoStoragePath: videoUpload?.storagePath,
            prompt: nodeData.prompt || "",
            mode: (nodeData.parameters?.mode as string) || nodeData.mode || "pro",
            keep_original_sound: nodeData.parameters?.keep_original_sound ?? true,
            character_orientation: nodeData.parameters?.character_orientation || "image",
            tool: "node",
          }),
        })
      } else if (isLipsync) {
        response = await fetch("/api/generate-lipsync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: imageUpload?.url,
            audioUrl: audioUpload?.url,
            imageStoragePath: imageUpload?.storagePath,
            audioStoragePath: audioUpload?.storagePath,
            resolution: nodeData.parameters?.resolution || "720p",
          }),
        })
      } else {
        const requestBody: Record<string, unknown> = {
          model: modelIdentifier,
          prompt: nodeData.prompt || "",
          ...(nodeData.parameters || {}),
        }

        if (nodeData.negativePrompt && !requestBody.negative_prompt) {
          requestBody.negative_prompt = nodeData.negativePrompt
        }

        if (imageUpload?.url) {
          if (modelIdentifier === "kwaivgi/kling-v2.6") {
            requestBody.start_image = imageUpload.url
          } else {
            requestBody.image = imageUpload.url
          }
          if (modelIdentifier === "minimax/hailuo-2.3-fast") {
            requestBody.first_frame_image = imageUpload.url
          }
        }
        if (lastFrameUpload?.url) {
          requestBody.last_frame = lastFrameUpload.url
        }

        requestBody.tool = "node"

        response = await fetch("/api/generate-video-any-model", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })
      }

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || err.message || "Failed to generate video")
      }

      const result = await response.json()
      const videoUrl = result.video?.url || result.videoUrl
      if (!videoUrl) throw new Error("No video URL received")

      nodeData.onDataChange?.(id, {
        generatedVideoUrl: videoUrl,
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
  const isMotionCopyModel = selectedModel?.identifier === "kwaivgi/kling-v2.6-motion-control"
  const isLipsyncModel = selectedModel?.identifier === "veed/fabric-1.0"
  const needsPrompt = !isMotionCopyModel && !isLipsyncModel
  const modelSupportsNegativePrompt = selectedModel?.parameters.parameters?.some(
    (param) => param.name === "negative_prompt"
  )
  const modelSupportsImage = selectedModel?.parameters.parameters?.some(
    (param) =>
      param.name === "image" ||
      param.name === "first_frame_image" ||
      param.name === "start_image"
  )
  const modelSupportsLastFrame = selectedModel?.parameters.parameters?.some(
    (param) => param.name === "last_frame"
  )

  const showImageUpload = !!(modelSupportsImage || isMotionCopyModel || isLipsyncModel)
  const showVideoUpload = !!isMotionCopyModel
  const showAudioUpload = !!isLipsyncModel
  const showLastFrameUpload = !!modelSupportsLastFrame
  const hasUploadOptions = showImageUpload || showVideoUpload || showAudioUpload || showLastFrameUpload

  const getImageUploadLabel = () => {
    if (selectedModel?.identifier === "kwaivgi/kling-v2.6") return "Upload Start Image"
    if (selectedModel?.identifier === "minimax/hailuo-2.3-fast") return "Upload First Frame"
    return "Upload Input Image"
  }

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
        className={cn(
          "relative w-full h-full",
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
              ? "border-blue-500/40 ring-1 ring-blue-500/20"
              : !hasContent && "border-white/10 hover:border-white/20",
            hasContent && selected && "ring-2 ring-blue-500/40"
          )}
        >

          {/* Content area: loading state, hints, OR generated preview */}
          {nodeData.isGenerating ? (
            <div className="relative w-full h-full overflow-hidden bg-zinc-900 rounded-lg">
              {/* Progress fill */}
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-zinc-800 to-zinc-700 rounded-lg"
                style={{
                  width: '0%',
                  animation: 'fillProgress 120s linear infinite',
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
              <video
                src={nodeData.generatedVideoUrl!}
                controls
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-full h-full px-4 flex items-center justify-center">
              <p className="text-xs text-zinc-500 text-center leading-relaxed max-w-[220px]">
                Describe the video you want, then click Generate. Optionally add an image, video, or audio reference.
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
          <div className="w-6 h-6 rounded-full border-2 border-blue-500 bg-zinc-900 flex items-center justify-center cursor-crosshair hover:bg-blue-500/10 transition-colors">
            <Plus size={14} weight="bold" className="text-blue-500 pointer-events-none" />
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
            const finalAudioUrl = nodeData.manualAudioUrl || nodeData.connectedAudioUrl
            const finalLastFrameUrl = nodeData.manualLastFrameUrl || null
            const hasMedia = finalImageUrl || finalVideoUrl || finalAudioUrl || finalLastFrameUrl
            
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

                  {/* Last frame preview */}
                  {finalLastFrameUrl && (
                    <div className="relative rounded-lg overflow-hidden border border-white/10 group" style={{ width: '120px', height: '80px' }}>
                      <img
                        src={finalLastFrameUrl}
                        alt="Last frame input"
                        className="w-full h-full object-cover bg-black/20"
                      />
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-zinc-900/80 text-[9px] text-zinc-400">
                        Last Frame
                      </div>
                      {nodeData.manualLastFrameUrl && (
                        <button
                          onClick={handleRemoveLastFrame}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remove last frame"
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

                  {/* Audio preview */}
                  {finalAudioUrl && (
                    <div className="relative rounded-lg overflow-hidden border border-white/10 group flex items-center justify-center bg-zinc-900/60" style={{ width: '120px', height: '80px' }}>
                      <div className="text-[10px] text-zinc-300">Audio</div>
                      {nodeData.manualAudioUrl && (
                        <button
                          onClick={handleRemoveAudio}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remove audio"
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

          {(isMotionCopyModel || isLipsyncModel) && (
            <div className="flex gap-2">
              <div className="flex-1">
                <PhotoUpload
                  value={
                    (nodeData.manualImageUrl || nodeData.connectedImageUrl)
                      ? ({ file: nodeData.manualImageFile || undefined, url: nodeData.manualImageUrl || nodeData.connectedImageUrl || "" } as ImageUpload)
                      : null
                  }
                  onChange={handleCustomImageChange}
                  title="Upload Image"
                  description="Click to upload"
                />
              </div>
              {isMotionCopyModel && (
                <div className="flex-1">
                  <VideoUpload
                    value={
                      (nodeData.manualVideoUrl || nodeData.connectedVideoUrl)
                        ? ({ file: nodeData.manualVideoFile || undefined, url: nodeData.manualVideoUrl || nodeData.connectedVideoUrl || "" } as ImageUpload)
                        : null
                    }
                    onChange={handleCustomVideoChange}
                    title="Upload Video"
                    description="Click to upload"
                  />
                </div>
              )}
              {isLipsyncModel && (
                <div className="flex-1">
                  <AudioUpload
                    value={
                      (nodeData.manualAudioUrl || nodeData.connectedAudioUrl)
                        ? ({ file: nodeData.manualAudioFile || undefined, url: nodeData.manualAudioUrl || nodeData.connectedAudioUrl || "" } as AudioUploadValue)
                        : null
                    }
                    onChange={handleCustomAudioChange}
                    title="Upload Audio"
                    description="Click to upload"
                  />
                </div>
              )}
            </div>
          )}

          {needsPrompt && (
            <VideoPromptFields
              promptValue={nodeData.prompt || ""}
              onPromptChange={(value) => nodeData.onDataChange?.(id, { prompt: value })}
              negativePromptValue={nodeData.negativePrompt || ""}
              onNegativePromptChange={(value) => nodeData.onDataChange?.(id, { negativePrompt: value })}
              showNegativePrompt={!!modelSupportsNegativePrompt}
              placeholder="Describe the video you want to generate..."
              variant="toolbar"
            />
          )}

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

        {/* Bottom bar: model controls + generate */}
        <div className="border-t border-white/5 px-3 py-2.5 flex flex-nowrap items-center gap-2 overflow-x-auto">
          {/* Add Media Button with Dropdown */}
{hasUploadOptions && (
  <DropdownMenu open={isAddMediaOpen} onOpenChange={setIsAddMediaOpen}>
    <DropdownMenuTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        className="h-7 w-7 p-0"
        title="Add media"
      >
        <Plus size={16} />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent side="top" align="start" className="nopan nodrag">
      {showImageUpload && (
        <DropdownMenuItem 
          onClick={() => imageUploadRef.current?.click()}
          disabled={!!(nodeData.manualImageUrl || nodeData.connectedImageUrl)}
        >
          <ImageIcon size={14} className="mr-2" />
          {getImageUploadLabel()} {(nodeData.manualImageUrl || nodeData.connectedImageUrl) && 'OK'}
        </DropdownMenuItem>
      )}
                {showLastFrameUpload && (
                  <DropdownMenuItem
                    onClick={() => lastFrameUploadRef.current?.click()}
                    disabled={!!nodeData.manualLastFrameUrl}
                  >
                    <ImageIcon size={14} className="mr-2" />
                    Upload Last Frame {nodeData.manualLastFrameUrl && 'OK'}
                  </DropdownMenuItem>
                )}
      {showVideoUpload && (
        <DropdownMenuItem
          onClick={() => videoUploadRef.current?.click()}
          disabled={!!(nodeData.manualVideoUrl || nodeData.connectedVideoUrl)}
        >
          <VideoCamera size={14} className="mr-2" />
          Upload Video {(nodeData.manualVideoUrl || nodeData.connectedVideoUrl) && 'OK'}
        </DropdownMenuItem>
      )}
      {showAudioUpload && (
        <DropdownMenuItem
          onClick={() => audioUploadRef.current?.click()}
          disabled={!!(nodeData.manualAudioUrl || nodeData.connectedAudioUrl)}
        >
          <VideoCamera size={14} className="mr-2" />
          Upload Audio {(nodeData.manualAudioUrl || nodeData.connectedAudioUrl) && 'OK'}
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
)}

{/* Hidden file inputs */}
          <input
            ref={imageUploadRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <input
            ref={lastFrameUploadRef}
            type="file"
            accept="image/*"
            onChange={handleLastFrameUpload}
            className="hidden"
          />
          <input
            ref={videoUploadRef}
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            className="hidden"
          />
          <input
            ref={audioUploadRef}
            type="file"
            accept="audio/*"
            onChange={handleAudioUpload}
            className="hidden"
          />

          {selectedModel && videoModels.length > 0 && (
            <VideoModelParameterControls
              videoModels={videoModels}
              selectedModel={selectedModel}
              onModelChange={(model) => {
                const defaults: Record<string, unknown> = {}
                model.parameters.parameters.forEach((param) => {
                  defaults[param.name] = param.default
                })
                nodeData.onDataChange?.(id, {
                  model: model.identifier,
                  parameters: defaults,
                })
              }}
              parameters={nodeData.parameters || {}}
              onParametersChange={(params) => nodeData.onDataChange?.(id, { parameters: params })}
              disabled={nodeData.isGenerating}
              variant="toolbar"
            />
          )}

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

    {nodeData.generatedVideoUrl && (
      <CreateAssetDialog
        open={isCreateAssetOpen}
        onOpenChange={setIsCreateAssetOpen}
        initial={{
          title,
          url: nodeData.generatedVideoUrl,
          assetType: "video",
          sourceNodeType: "video-gen",
        }}
      />
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
