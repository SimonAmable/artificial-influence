"use client"

import * as React from "react"
import { Sparkle, Plus, X, CircleNotch } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FilePlus } from "@phosphor-icons/react"
import { useImageEditor } from "./image-editor-provider"
import { useModels } from "@/hooks/use-models"
import { AspectRatioSelector } from "@/components/shared/selectors/aspect-ratio-selector"
import { ModelIcon } from "@/components/shared/icons/model-icon"
import { getActiveModelMetadata, type ModelMetadata } from "@/lib/constants/model-metadata"
import type { Model } from "@/lib/types/models"
import type { Canvas as FabricCanvas } from "fabric"
import { toast } from "sonner"

type CanvasWithMaskStore = FabricCanvas & {
  __maskWorkCanvas?: FabricCanvas
}

type MaskOverlayObject = {
  id?: string
  name?: string
  visible?: boolean
  dirty?: boolean
  set?: (key: string, value: unknown) => void
}

type ReferenceOverlayObject = MaskOverlayObject & {
  toDataURL?: (options?: Record<string, unknown>) => string
  layerId?: string
}

interface ImageEditorPromptBarProps {
  className?: string
  onGenerate?: (prompt: string, count: number) => Promise<void>
  onGeneratingChange?: (isGenerating: boolean) => void
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

export function ImageEditorPromptBar({
  className,
  onGenerate,
  onGeneratingChange,
}: ImageEditorPromptBarProps) {
  const { state, loadImage } = useImageEditor()
  const { models: imageModels, isLoading: modelsLoading } = useModels("image")
  const metadataModels = React.useMemo(
    () => getActiveModelMetadata("image"),
    []
  )
  const models = imageModels.length > 0
    ? imageModels
    : metadataModels.map(
        (m: ModelMetadata) =>
          ({
            id: m.id,
            identifier: m.identifier,
            name: m.name,
            description: m.description,
            type: m.type,
            provider: m.provider,
            is_active: m.is_active,
            model_cost: m.model_cost,
            parameters: { parameters: [] },
            created_at: "",
            updated_at: "",
            aspect_ratios: m.aspect_ratios,
            default_aspect_ratio: m.aspect_ratios[0],
          }) satisfies Model
      )

  const [prompt, setPrompt] = React.useState("")
  const [referenceFiles, setReferenceFiles] = React.useState<File[]>([])
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [selectedModel, setSelectedModel] = React.useState<string>("")
  const [selectedAspectRatio, setSelectedAspectRatio] =
    React.useState<string>("match_input_image")
  const [enhancePrompt, setEnhancePrompt] = React.useState(false)
  const editorInstruction = "apply the edit instructions from the image."
  const referenceInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      const first = models[0]
      setSelectedModel(first.identifier)
      setSelectedAspectRatio(
        first.default_aspect_ratio ?? first.aspect_ratios?.[0] ?? "match_input_image"
      )
    }
  }, [models, selectedModel])

  React.useEffect(() => {
    if (selectedModel && models.length > 0) {
      const model = models.find((m) => m.identifier === selectedModel)
      const fallbackAspectRatio = model?.aspect_ratios?.[0]
      if (model?.default_aspect_ratio || fallbackAspectRatio) {
        setSelectedAspectRatio(model?.default_aspect_ratio ?? fallbackAspectRatio ?? "match_input_image")
      }
    }
  }, [selectedModel, models])

  const selectedModelObject = React.useMemo(() => {
    if (!selectedModel) return null
    return models.find((m) => m.identifier === selectedModel) || null
  }, [selectedModel, models])

  const getMaskOverlay = (canvas: FabricCanvas): MaskOverlayObject | null => {
    const overlay = canvas.getObjects().find((obj) => {
      const candidate = obj as MaskOverlayObject
      return candidate.id === "mask-overlay" || candidate.name === "Mask"
    })
    return (overlay as MaskOverlayObject | undefined) ?? null
  }

  const dataUrlToFile = async (
    dataUrl: string,
    filename: string
  ): Promise<File> => {
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    return new File([blob], filename, { type: "image/png" })
  }

  const getNonBaseOverlays = (
    canvas: FabricCanvas
  ): ReferenceOverlayObject[] => {
    return canvas.getObjects().filter((obj) => {
      const candidate = obj as ReferenceOverlayObject
      const isBase =
        candidate.layerId === "base" || candidate.name === "Background Image"
      const isMask = candidate.id === "mask-overlay" || candidate.name === "Mask"
      return !isBase && !isMask
    }) as ReferenceOverlayObject[]
  }

  const exportGenerationInputs = async () => {
    const canvas = state.canvas as CanvasWithMaskStore | null
    if (!canvas) return null

    const maskOverlay = getMaskOverlay(canvas)
    const nonBaseOverlays = getNonBaseOverlays(canvas)
    const hadMask = !!maskOverlay

    if (maskOverlay?.set) {
      maskOverlay.set("visible", false)
      maskOverlay.dirty = true
    }
    canvas.requestRenderAll()
    const compositeDataUrl = canvas.toDataURL({ format: "png", multiplier: 1 })

    nonBaseOverlays.forEach((overlay) => {
      overlay.set?.("visible", false)
      overlay.dirty = true
    })
    canvas.requestRenderAll()
    const baseDataUrl = canvas.toDataURL({ format: "png", multiplier: 1 })

    nonBaseOverlays.forEach((overlay) => {
      overlay.set?.("visible", true)
      overlay.dirty = true
    })
    if (maskOverlay?.set) {
      maskOverlay.set("visible", true)
      maskOverlay.dirty = true
    }
    canvas.requestRenderAll()

    let maskDataUrl: string | null = null
    const maskWorkCanvas = canvas.__maskWorkCanvas
    if (hadMask && maskWorkCanvas) {
      maskDataUrl = maskWorkCanvas.toDataURL({ format: "png", multiplier: 1 })
    }

    return { baseDataUrl, compositeDataUrl, maskDataUrl, hadMask }
  }

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return

    setIsGenerating(true)
    onGeneratingChange?.(true)

    try {
      if (onGenerate) {
        await onGenerate(prompt, 1)
      } else {
        const formData = new FormData()
        const exports = await exportGenerationInputs()

        let finalPrompt = prompt.trim()
        if (!finalPrompt.toLowerCase().includes(editorInstruction)) {
          finalPrompt = `${finalPrompt}\n\n${editorInstruction}`
        }

        finalPrompt = `${finalPrompt}\n\nThe first reference image is the clean base. The second reference image is the edited composite with accessories/overlays. Apply the edit intent from the composite while preserving identity and realism.`

        if (exports?.hadMask) {
          finalPrompt = `${finalPrompt}\n\nEdit only the masked area from the provided mask image. Preserve everything outside the mask exactly unchanged.`
          formData.append("hasMask", "true")
        }

        formData.append("prompt", finalPrompt)
        formData.append("n", "1")
        formData.append("aspect_ratio", selectedAspectRatio)
        formData.append("aspectRatio", selectedAspectRatio)
        formData.append("enhancePrompt", enhancePrompt.toString())
        if (selectedModel) {
          formData.append("model", selectedModel)
        }

        if (exports?.baseDataUrl) {
          const baseFile = await dataUrlToFile(
            exports.baseDataUrl,
            "base-image.png"
          )
          formData.append("referenceImages", baseFile)
        } else if (state.currentImage) {
          const response = await fetch(state.currentImage)
          const blob = await response.blob()
          const file = new File([blob], "base-image.png", {
            type: "image/png",
          })
          formData.append("referenceImages", file)
        }

        if (exports?.compositeDataUrl) {
          const compositeFile = await dataUrlToFile(
            exports.compositeDataUrl,
            "composite-image.png"
          )
          formData.append("referenceImages", compositeFile)
        }

        if (exports?.maskDataUrl) {
          const maskFile = await dataUrlToFile(
            exports.maskDataUrl,
            "mask-image.png"
          )
          formData.append("referenceImages", maskFile)
        }

        referenceFiles.forEach((file) => {
          formData.append("referenceImages", file)
        })

        const response = await fetch("/api/generate-image", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          
          // Handle insufficient credits (402)
          if (response.status === 402) {
            toast.error(errorData.message || "Insufficient credits", {
              description: "Upgrade your plan to continue generating images",
              action: {
                label: "View Plans",
                onClick: () => window.open("/pricing", "_blank")
              }
            })
            return
          }
          
          throw new Error("Generation failed")
        }

        const data = await response.json()

        if (data.images?.[0]?.url) {
          await loadImage(data.images[0].url)
        } else if (data.image?.url) {
          await loadImage(data.image.url)
        }
      }
    } catch (error) {
      console.error("Generation failed:", error)
    } finally {
      setIsGenerating(false)
      onGeneratingChange?.(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleGenerate()
    }
  }

  const handlePaste = React.useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageFiles: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault()
      setReferenceFiles((prev) => [...prev, ...imageFiles])
    }
  }, [])

  const handleAddReferences = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((file) =>
      file.type.startsWith("image/")
    )
    if (files.length > 0) {
      setReferenceFiles((prev) => [...prev, ...files])
    }
    e.target.value = ""
  }

  const removeReference = (index: number) => {
    setReferenceFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const isReady = prompt.trim().length > 0

  return (
    <Card
      className={cn(
        "w-full max-w-sm sm:max-w-lg lg:max-w-4xl",
        className
      )}
    >
      <CardContent className="p-2 flex flex-col gap-1.5">
        {/* Reference images preview */}
        {referenceFiles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {referenceFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="h-6 px-2 rounded-md bg-muted border border-border text-[11px] text-muted-foreground flex items-center gap-1.5 max-w-[220px]"
              >
                <span className="truncate">{file.name}</span>
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => removeReference(index)}
                  type="button"
                  title="Remove reference"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea and Generate Button - Side by Side (like InfluencerInputBox) */}
        <div className="flex items-start gap-2 pt-1 px-2">
          <div className="flex-1">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              placeholder="Enter prompt for image editing..."
              className="w-full border-none outline-none resize-none bg-transparent text-sm min-h-[60px] max-h-[120px] overflow-y-auto"
              rows={3}
              disabled={isGenerating}
            />
          </div>

          <div className="shrink-0">
            <div
              className={cn(
                "relative inline-block transition-all duration-300",
                isReady &&
                  "before:content-[''] before:absolute before:inset-[-12px] before:bg-primary before:rounded-full before:blur-[15px] before:opacity-50 before:-z-10"
              )}
            >
              <Button
                onClick={handleGenerate}
                disabled={!isReady || isGenerating}
                className={cn(
                  "bg-primary hover:bg-primary/80 text-primary-foreground font-semibold h-10 min-w-[100px] text-sm px-4 py-6 transition-all duration-300 relative z-0",
                  !isReady && "opacity-50 cursor-not-allowed"
                )}
              >
                {isGenerating ? (
                  <>
                    <CircleNotch className="size-3 mr-1.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-sm font-semibold">Generate</span>
                    <div className="flex items-center gap-0.5">
                      <Sparkle size={8} weight="fill" />
                      <span className="text-[10px]">
                        {selectedModelObject?.model_cost != null
                          ? selectedModelObject.model_cost
                          : "—"}
                      </span>
                    </div>
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Controls: Add Reference Image, Model Selector, Aspect Ratio, Enhance Prompt */}
        <div className="flex items-center gap-1.5">
          <input
            ref={referenceInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleAddReferences}
            className="hidden"
            aria-label="Add reference images"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full bg-muted hover:bg-muted/80"
                aria-label="Add reference image"
                disabled={isGenerating}
              >
                <Plus className="size-3.5" weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => referenceInputRef.current?.click()}
              >
                <FilePlus className="size-4 mr-2" />
                Add Reference Image
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Select
            value={selectedModel || ""}
            onValueChange={(value) => setSelectedModel(value)}
            disabled={isGenerating || modelsLoading}
          >
            <SelectTrigger
              id="image-editor-model-select"
              className="h-7 text-xs w-fit min-w-[120px]"
            >
              <SelectValue placeholder="Select model">
                {selectedModel && (
                  <div className="flex items-center gap-2">
                    <ModelIcon identifier={selectedModel} size={16} />
                    <span>
                      {selectedModelObject
                        ? formatModelName(
                            selectedModelObject.identifier,
                            selectedModelObject.name
                          )
                        : selectedModel}
                    </span>
                  </div>
                )}
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

          <AspectRatioSelector
            model={selectedModelObject}
            value={selectedAspectRatio}
            onValueChange={setSelectedAspectRatio}
            disabled={isGenerating}
          />

          <div className="h-7 flex items-center gap-1.5 px-2 py-[18px] rounded-[28px] border border-border bg-muted/30">
            <Switch
              id="image-editor-enhance-prompt"
              checked={enhancePrompt}
              onCheckedChange={setEnhancePrompt}
              className="scale-90"
            />
            <Label
              htmlFor="image-editor-enhance-prompt"
              className="text-xs cursor-pointer"
            >
              <span className="hidden md:inline">Enhance Prompt</span>
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
