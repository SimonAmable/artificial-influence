import type { Node, Edge } from "@xyflow/react"

// ===== Node Type Identifiers =====
export type CanvasNodeType = "image-gen" | "video-gen" | "text" | "audio" | "upload" | "group"

// ===== Node Data Shapes =====

export interface ImageGenNodeData extends Record<string, unknown> {
  label: string
  prompt: string
  connectedPrompt: string // Text from connected nodes (grayed out)
  connectedImageUrls: string[] // Images from connected upload/image nodes (preview)
  manualImageUrls: string[] // Manually uploaded/selected reference images
  model: string
  aspectRatio: string
  enhancePrompt: boolean
  generatedImageUrl: string | null
  isGenerating: boolean
  error: string | null
  onDataChange?: (id: string, data: Partial<ImageGenNodeData>) => void
}

export interface VideoGenNodeData extends Record<string, unknown> {
  label: string
  imageUrl: string
  videoUrl: string
  connectedImageUrl: string | null // Image from connected upload/image nodes (single)
  connectedVideoUrl: string | null // Video from connected upload nodes (single)
  manualImageUrl: string | null // Manually uploaded image (single)
  manualVideoUrl: string | null // Manually uploaded video (single)
  manualImageFile: File | null // Store file for client-side upload
  manualVideoFile: File | null // Store file for client-side upload
  prompt: string
  mode: "pro" | "std"
  generatedVideoUrl: string | null
  isGenerating: boolean
  error: string | null
  onDataChange?: (id: string, data: Partial<VideoGenNodeData>) => void
}

export interface TextNodeData extends Record<string, unknown> {
  label: string
  text: string
  connectedPrompt?: string
  connectedImageUrl?: string
  isGenerating?: boolean
  onDataChange?: (id: string, data: Partial<TextNodeData>) => void
}

export interface AudioNodeData extends Record<string, unknown> {
  label: string
  text: string
  voice: string
  generatedAudioUrl: string | null
  isGenerating: boolean
  error: string | null
  onDataChange?: (id: string, data: Partial<AudioNodeData>) => void
}

export interface UploadNodeData extends Record<string, unknown> {
  label: string
  fileUrl: string | null
  fileType: "image" | "video" | "audio" | null
  fileName: string | null
  onDataChange?: (id: string, data: Partial<UploadNodeData>) => void
}

export interface GroupNodeData extends Record<string, unknown> {
  label: string
  backgroundColor?: string
  onDataChange?: (id: string, data: Partial<GroupNodeData>) => void
}

// Union type
export type CanvasNodeData =
  | ImageGenNodeData
  | VideoGenNodeData
  | TextNodeData
  | AudioNodeData
  | UploadNodeData
  | GroupNodeData

// ===== Typed Node Aliases =====
export type ImageGenNode = Node<ImageGenNodeData, "image-gen">
export type VideoGenNode = Node<VideoGenNodeData, "video-gen">
export type TextNode = Node<TextNodeData, "text">
export type AudioNode = Node<AudioNodeData, "audio">
export type UploadNode = Node<UploadNodeData, "upload">
export type GroupNode = Node<GroupNodeData, "group">

export type CanvasNode = ImageGenNode | VideoGenNode | TextNode | AudioNode | UploadNode | GroupNode

// ===== Default Data Factories =====

export function createImageGenNodeData(): ImageGenNodeData {
  return {
    label: "image",
    prompt: "",
    connectedPrompt: "",
    connectedImageUrls: [],
    manualImageUrls: [],
    model: "google/nano-banana",
    aspectRatio: "1:1",
    enhancePrompt: false,
    generatedImageUrl: null,
    isGenerating: false,
    error: null,
  }
}

export function createVideoGenNodeData(): VideoGenNodeData {
  return {
    label: "Video Generation",
    imageUrl: "",
    videoUrl: "",
    connectedImageUrl: null,
    connectedVideoUrl: null,
    manualImageUrl: null,
    manualVideoUrl: null,
    manualImageFile: null,
    manualVideoFile: null,
    prompt: "",
    mode: "pro",
    generatedVideoUrl: null,
    isGenerating: false,
    error: null,
  }
}

export function createTextNodeData(): TextNodeData {
  return {
    label: "Text",
    text: "",
    isGenerating: false,
  }
}

export function createAudioNodeData(): AudioNodeData {
  return {
    label: "Audio Generation",
    text: "",
    voice: "alloy",
    generatedAudioUrl: null,
    isGenerating: false,
    error: null,
  }
}

export function createUploadNodeData(): UploadNodeData {
  return {
    label: "Upload",
    fileUrl: null,
    fileType: null,
    fileName: null,
  }
}

export function createGroupNodeData(): GroupNodeData {
  return {
    label: "Group",
    backgroundColor: "rgba(30, 30, 30, 0.4)",
  }
}

// ===== Workflow Persistence =====

export interface SavedWorkflow {
  id: string
  name: string
  nodes: Node[]
  edges: Edge[]
  savedAt: string
}

// ===== Execution Types =====

export interface NodeOutput {
  text?: string
  imageUrl?: string
  videoUrl?: string
  audioUrl?: string
  fileUrl?: string
  fileType?: string
}

export interface ExecutionCallbacks {
  onNodeStart: (nodeId: string) => void
  onNodeComplete: (nodeId: string, output: NodeOutput) => void
  onNodeError: (nodeId: string, error: string) => void
}
