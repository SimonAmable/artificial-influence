"use client"

import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import type { Model } from "@/lib/types/models"
import { CHARACTER_SWAP_TOOL } from "@/lib/image/studio-tools/character-swap"
import { DualReferenceSwapInputBox } from "@/components/tools/image-studio/dual-reference-swap-input-box"

export interface CharacterSwapInputBoxProps {
  className?: string
  characterImage?: ImageUpload | null
  sceneImage?: ImageUpload | null
  onCharacterImageChange?: (image: ImageUpload | null) => void
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

/** @deprecated Use ImageStudioToolInput with CHARACTER_SWAP_TOOL instead. */
export function CharacterSwapInputBox({
  characterImage,
  sceneImage,
  onCharacterImageChange,
  onSceneImageChange,
  ...props
}: CharacterSwapInputBoxProps) {
  return (
    <DualReferenceSwapInputBox
      referenceSlots={CHARACTER_SWAP_TOOL.referenceSlots}
      sourceImage={characterImage}
      sceneImage={sceneImage}
      onSourceImageChange={onCharacterImageChange}
      onSceneImageChange={onSceneImageChange}
      {...props}
    />
  )
}
