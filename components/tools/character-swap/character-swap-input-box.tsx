"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PhotoUpload, ImageUpload } from "@/components/shared/upload/photo-upload"
import { CircleNotch, Sparkle, FilePlus, Plus } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Model } from "@/lib/types/models"
import { ModelIcon } from "@/components/shared/icons/model-icon"

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
}

export function CharacterSwapInputBox({
  className,
  characterImage,
  sceneImage,
  onCharacterImageChange,
  onSceneImageChange,
  onGenerate,
  isGenerating = false,
  selectedModel,
  onModelChange,
  models = [],
  showModelSelector = false,
}: CharacterSwapInputBoxProps) {
  const characterInputRef = React.useRef<HTMLInputElement>(null)
  const sceneInputRef = React.useRef<HTMLInputElement>(null)

  const isReady = React.useMemo(() => {
    return Boolean(characterImage && sceneImage)
  }, [characterImage, sceneImage])

  const formatModelName = React.useCallback((identifier: string, name: string): string => {
    if (name && !name.includes("/")) {
      return name
    }
    const parts = identifier.split("/")
    const shortIdentifier = parts[parts.length - 1]
    return shortIdentifier
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }, [])

  const handleQuickUpload = React.useCallback((target: "character" | "scene", file?: File) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const payload: ImageUpload = { file, url }
    if (target === "character") {
      onCharacterImageChange?.(payload)
      return
    }
    onSceneImageChange?.(payload)
  }, [onCharacterImageChange, onSceneImageChange])

  return (
    <Card className={cn("w-full max-w-sm sm:max-w-lg lg:max-w-4xl relative", className)}>
      <CardContent className="p-2 flex flex-col gap-1.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <PhotoUpload
            value={characterImage}
            onChange={onCharacterImageChange}
            title="Reference Character"
            description="Upload character image"
          />
          <PhotoUpload
            value={sceneImage}
            onChange={onSceneImageChange}
            title="Reference Scene"
            description="Upload scene image"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full bg-muted hover:bg-muted/80"
                aria-label="Upload references"
              >
                <Plus className="size-3.5" weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => characterInputRef.current?.click()}>
                <FilePlus className="size-4 mr-2" />
                Upload Character Image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => sceneInputRef.current?.click()}>
                <FilePlus className="size-4 mr-2" />
                Upload Scene Image
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {showModelSelector && (
            <Select
              value={selectedModel || ""}
              onValueChange={(value) => onModelChange?.(value)}
              disabled={isGenerating}
            >
              <SelectTrigger id="model-select-character-swap" className="h-7 text-xs w-[180px] shrink-0">
                <SelectValue placeholder="Select model">
                  {selectedModel && (() => {
                    const model = models.find((m) => m.identifier === selectedModel)
                    return (
                      <div className="flex items-center gap-2">
                        <ModelIcon identifier={selectedModel} size={16} />
                        <span className="truncate">{model ? formatModelName(model.identifier, model.name) : selectedModel}</span>
                      </div>
                    )
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent position="popper" side="top" sideOffset={4}>
                {models.map((model) => (
                  <SelectItem key={model.identifier} value={model.identifier}>
                    <div className="flex items-center gap-3">
                      <div className="rounded-md border border-border bg-muted/30 p-1.5 shrink-0">
                        <ModelIcon identifier={model.identifier} size={20} />
                      </div>
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="font-semibold text-sm">
                          {formatModelName(model.identifier, model.name)}
                        </span>
                        {model.description && (
                          <span className="text-xs text-muted-foreground">
                            {model.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="ml-auto">
            <Button
              onClick={onGenerate}
              disabled={!isReady || isGenerating}
              className={cn("min-h-[50px] min-w-[110px] text-sm font-semibold", !isReady && "opacity-50 cursor-not-allowed")}
            >
              {isGenerating ? (
                <>
                  <CircleNotch className="size-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm font-semibold">Generate</span>
                  <div className="flex items-center gap-0.5">
                    <Sparkle size={8} weight="fill" />
                    <span className="text-[10px]">4 credits</span>
                  </div>
                </div>
              )}
            </Button>
          </div>
        </div>

        <input
          ref={characterInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleQuickUpload("character", e.target.files?.[0])}
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
