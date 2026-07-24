"use client"

import * as React from "react"
import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import type { Model } from "@/lib/types/models"
import type { ImageStudioToolDefinition } from "@/lib/image/studio-tools/types"
import { DualReferenceSwapInputBox } from "./dual-reference-swap-input-box"

export interface ImageStudioToolInputProps {
  tool: ImageStudioToolDefinition
  className?: string
  sourceImage?: ImageUpload | null
  sceneImage?: ImageUpload | null
  onSourceImageChange?: (image: ImageUpload | null) => void
  onSceneImageChange?: (image: ImageUpload | null) => void
  onGenerate?: () => void
  isGenerating?: boolean
  selectedModel?: string
  onModelChange?: (modelIdentifier: string) => void
  models?: Model[]
  showModelSelector?: boolean
  allowConcurrent?: boolean
  allowOptionsDuringGeneration?: boolean
}

export function ImageStudioToolInput({
  tool,
  ...props
}: ImageStudioToolInputProps) {
  switch (tool.inputKind) {
    case "dual-reference-swap":
      return (
        <DualReferenceSwapInputBox
          referenceSlots={tool.referenceSlots}
          {...props}
        />
      )
    case "standard":
      return null
    default: {
      const _exhaustive: never = tool.inputKind
      return _exhaustive
    }
  }
}
