"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PhotoUpload, ImageUpload } from "@/components/shared/upload/photo-upload"
import { CircleNotch, Sparkle, FilePlus, Plus, User, Smiley, ArrowsClockwise } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "framer-motion"
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Model } from "@/lib/types/models"
import { ModelIcon } from "@/components/shared/icons/model-icon"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type CharacterSwapMode = "full_character" | "identity_only"

const CHARACTER_SWAP_MODES: Array<{
  value: CharacterSwapMode
  label: string
  ariaLabel: string
  icon: React.ComponentType<{ className?: string; weight?: "regular" | "bold" | "fill" | "duotone" | "light" | "thin" }>
}> = [
  {
    value: "full_character",
    label: "Full Character",
    ariaLabel: "Use full character from image one",
    icon: User,
  },
  {
    value: "identity_only",
    label: "Identity Only",
    ariaLabel: "Use identity from image one only",
    icon: Smiley,
  },
]

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
  selectedSwapMode?: CharacterSwapMode
  onSwapModeChange?: (mode: CharacterSwapMode) => void
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
  selectedSwapMode = "full_character",
  onSwapModeChange,
}: CharacterSwapInputBoxProps) {
  const characterInputRef = React.useRef<HTMLInputElement>(null)
  const sceneInputRef = React.useRef<HTMLInputElement>(null)
  const [localSwapMode, setLocalSwapMode] = React.useState<CharacterSwapMode>(selectedSwapMode)

  React.useEffect(() => {
    setLocalSwapMode(selectedSwapMode)
  }, [selectedSwapMode])

  const toolModels = React.useMemo(() => models.filter((m) => m.identifier.startsWith("custom/")), [models])
  const imageModelsOnly = React.useMemo(() => models.filter((m) => !m.identifier.startsWith("custom/")), [models])
  const showGroups = toolModels.length > 0 && imageModelsOnly.length > 0

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

  const activeSwapMode = onSwapModeChange ? selectedSwapMode : localSwapMode
  const hasBothImages = Boolean(characterImage && sceneImage)

  const handleSwapImages = React.useCallback(() => {
    if (!characterImage || !sceneImage) return
    onCharacterImageChange?.(sceneImage)
    onSceneImageChange?.(characterImage)
  }, [characterImage, sceneImage, onCharacterImageChange, onSceneImageChange])

  return (
    <Card className={cn("w-full max-w-sm sm:max-w-lg lg:max-w-4xl relative", className)}>
      <CardContent className="p-2 flex flex-col gap-1.5">
        <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                  aria-label="Swap character and scene images"
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
                aria-label="Swap character and scene images"
                title="Swap images"
              >
                <ArrowsClockwise className="size-4" weight="bold" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center gap-1 px-1">
          <span className="text-[11px] font-medium text-muted-foreground mr-1">Mode:</span>
          <ToggleGroup
            type="single"
            value={activeSwapMode}
            onValueChange={(value) => {
              if (!value) return
              const mode = value as CharacterSwapMode
              setLocalSwapMode(mode)
              onSwapModeChange?.(mode)
            }}
            variant="outline"
            size="sm"
            spacing={1}
            className="flex-wrap"
            aria-label="Character swap mode"
          >
            {CHARACTER_SWAP_MODES.map((mode) => {
              const Icon = mode.icon
              return (
                <ToggleGroupItem
                  key={mode.value}
                  value={mode.value}
                  aria-label={mode.ariaLabel}
                  className="h-7 px-2.5 text-xs rounded-full"
                >
                  <Icon className="size-3.5 mr-1.5" weight="bold" />
                  {mode.label}
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
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
                {showGroups ? (
                  <>
                    <SelectGroup>
                      <SelectLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Tools
                      </SelectLabel>
                      {toolModels.map((model) => (
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
                                <span className="text-xs text-muted-foreground">{model.description}</span>
                              )}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Models
                      </SelectLabel>
                      {imageModelsOnly.map((model) => (
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
                                <span className="text-xs text-muted-foreground">{model.description}</span>
                              )}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                ) : (
                  models.map((model) => (
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
                            <span className="text-xs text-muted-foreground">{model.description}</span>
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  ))
                )}
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
