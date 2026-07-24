"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PhotoUpload, type ImageUpload } from "@/components/shared/upload/photo-upload"
import { FilePlus, Plus, ArrowsClockwise } from "@phosphor-icons/react"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Model } from "@/lib/types/models"
import { ModelIcon } from "@/components/shared/icons/model-icon"
import type { ImageStudioReferenceSlot } from "@/lib/image/studio-tools/types"
import { GenerateShaderButton } from "@/components/tools/influencer/generate-shader-button"
import {
  AnimatedControlItem,
  AnimatedSelectLabel,
  influencerControlIconButtonClassName,
  influencerControlPillClassName,
  influencerControlsPresenceProps,
} from "@/components/tools/influencer/animated-control-item"
import {
  PromptControlMenuContent,
  PromptControlMenuGroup,
  PromptControlMenuItem,
  PromptControlMenuSeparator,
} from "@/components/tools/influencer/prompt-control-menu"

export interface DualReferenceSwapInputBoxProps {
  className?: string
  referenceSlots: ImageStudioReferenceSlot[]
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

function formatModelName(identifier: string, name: string): string {
  if (name && !name.includes("/")) {
    return name
  }
  const parts = identifier.split("/")
  const shortIdentifier = parts[parts.length - 1]
  return shortIdentifier
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function DualReferenceSwapInputBox({
  className,
  referenceSlots,
  sourceImage,
  sceneImage,
  onSourceImageChange,
  onSceneImageChange,
  onGenerate,
  isGenerating = false,
  selectedModel,
  onModelChange,
  models = [],
  showModelSelector = false,
  allowConcurrent = false,
  allowOptionsDuringGeneration = false,
}: DualReferenceSwapInputBoxProps) {
  const sourceInputRef = React.useRef<HTMLInputElement>(null)
  const sceneInputRef = React.useRef<HTMLInputElement>(null)

  const sourceSlot = referenceSlots[0]
  const sceneSlot = referenceSlots[1]

  const toolModels = React.useMemo(() => models.filter((m) => m.identifier.startsWith("custom/")), [models])
  const imageModelsOnly = React.useMemo(() => models.filter((m) => !m.identifier.startsWith("custom/")), [models])
  const showModelGroups = toolModels.length > 0 && imageModelsOnly.length > 0

  const isReady = Boolean(sourceImage && sceneImage)
  const hasBothImages = isReady

  const selectedModelObject = React.useMemo(
    () => models.find((m) => m.identifier === selectedModel) ?? null,
    [models, selectedModel],
  )

  const handleQuickUpload = React.useCallback(
    (target: "source" | "scene", file?: File) => {
      if (!file) return
      const url = URL.createObjectURL(file)
      const payload: ImageUpload = { file, url }
      if (target === "source") {
        onSourceImageChange?.(payload)
        return
      }
      onSceneImageChange?.(payload)
    },
    [onSourceImageChange, onSceneImageChange],
  )

  const handleSwapImages = React.useCallback(() => {
    if (!sourceImage || !sceneImage) return
    onSourceImageChange?.(sceneImage)
    onSceneImageChange?.(sourceImage)
  }, [onSceneImageChange, onSourceImageChange, sceneImage, sourceImage])

  return (
    <Card
      className={cn(
        "w-full max-w-sm sm:max-w-lg lg:max-w-4xl relative transition-colors bg-background/95 backdrop-blur-sm overflow-visible",
        className,
      )}
    >
      <CardContent className="flex min-w-0 flex-col gap-1.5 p-2">
        <div className="relative grid grid-cols-1 gap-2 sm:grid-cols-2">
          <PhotoUpload
            value={sourceImage}
            onChange={onSourceImageChange}
            title={sourceSlot?.label ?? "Source"}
            description={sourceSlot?.description}
          />
          <PhotoUpload
            value={sceneImage}
            onChange={onSceneImageChange}
            title={sceneSlot?.label ?? "Scene"}
            description={sceneSlot?.description}
          />

          <AnimatePresence>
            {hasBothImages && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 4 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="pointer-events-none absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 sm:block"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleSwapImages}
                  className="pointer-events-auto h-8 w-8 rounded-full border-border/80 bg-background/90 shadow-sm backdrop-blur hover:bg-background"
                  aria-label="Swap reference images"
                  title="Swap images"
                >
                  <ArrowsClockwise className="size-4" weight="bold" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {hasBothImages && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: -2 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -2 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex justify-center sm:hidden"
            >
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleSwapImages}
                className="h-8 w-8 rounded-full border-border/80 bg-background/90 shadow-sm backdrop-blur hover:bg-background"
                aria-label="Swap reference images"
                title="Swap images"
              >
                <ArrowsClockwise className="size-4" weight="bold" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <LayoutGroup id="studio-tool-controls">
          <div className="flex min-w-0 items-center gap-1">
            <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden scroll-fade-x no-scrollbar [-webkit-overflow-scrolling:touch]">
              <AnimatedControlItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className={influencerControlIconButtonClassName}
                      aria-label="Upload references"
                    >
                      <Plus className="size-3.5" weight="bold" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => sourceInputRef.current?.click()}>
                      <FilePlus className="size-4 mr-2" />
                      Upload {sourceSlot?.label ?? "Source"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => sceneInputRef.current?.click()}>
                      <FilePlus className="size-4 mr-2" />
                      Upload {sceneSlot?.label ?? "Scene"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </AnimatedControlItem>

              <AnimatePresence {...influencerControlsPresenceProps}>
                {showModelSelector ? (
                  <AnimatedControlItem key="model-selector" appear>
                    <Select
                      value={selectedModel || ""}
                      onValueChange={(value) => onModelChange?.(value)}
                      disabled={!allowOptionsDuringGeneration && isGenerating}
                    >
                      <SelectTrigger id="model-select-studio-tool" hideChevron className={influencerControlPillClassName}>
                        <SelectValue placeholder="Select model">
                          {selectedModel && (() => {
                            const model = models.find((m) => m.identifier === selectedModel)
                            return (
                              <div className="flex items-center gap-2">
                                <ModelIcon identifier={selectedModel} size={16} />
                                <AnimatedSelectLabel
                                  value={model ? formatModelName(model.identifier, model.name) : selectedModel}
                                />
                              </div>
                            )
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <PromptControlMenuContent className="min-w-[14rem]">
                        {showModelGroups ? (
                          <>
                            <PromptControlMenuGroup label="Tools">
                              {toolModels.map((model) => (
                                <PromptControlMenuItem
                                  key={model.identifier}
                                  value={model.identifier}
                                  icon={<ModelIcon identifier={model.identifier} size={16} />}
                                  label={formatModelName(model.identifier, model.name)}
                                  description={model.description ?? undefined}
                                />
                              ))}
                            </PromptControlMenuGroup>
                            <PromptControlMenuSeparator />
                            <PromptControlMenuGroup label="Models">
                              {imageModelsOnly.map((model) => (
                                <PromptControlMenuItem
                                  key={model.identifier}
                                  value={model.identifier}
                                  icon={<ModelIcon identifier={model.identifier} size={16} />}
                                  label={formatModelName(model.identifier, model.name)}
                                  description={model.description ?? undefined}
                                />
                              ))}
                            </PromptControlMenuGroup>
                          </>
                        ) : (
                          <PromptControlMenuGroup label="Models">
                            {models.map((model) => (
                              <PromptControlMenuItem
                                key={model.identifier}
                                value={model.identifier}
                                icon={<ModelIcon identifier={model.identifier} size={16} />}
                                label={formatModelName(model.identifier, model.name)}
                                description={model.description ?? undefined}
                              />
                            ))}
                          </PromptControlMenuGroup>
                        )}
                      </PromptControlMenuContent>
                    </Select>
                  </AnimatedControlItem>
                ) : null}
              </AnimatePresence>
            </div>
            <div className="ml-auto shrink-0">
              <GenerateShaderButton
                layout="icon"
                isReady={isReady}
                isGenerating={isGenerating}
                allowConcurrent={allowConcurrent}
                onGenerate={onGenerate}
                creditCost={selectedModelObject?.model_cost ?? "-"}
              />
            </div>
          </div>
        </LayoutGroup>

        <input
          ref={sourceInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleQuickUpload("source", e.target.files?.[0])}
          className="hidden"
        />
        <input
          ref={sceneInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleQuickUpload("scene", e.target.files?.[0])}
          className="hidden"
        />
      </CardContent>
    </Card>
  )
}
