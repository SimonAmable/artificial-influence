"use client"

import * as React from "react"
import { Sparkle, Plus, X } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useImageEditor } from "./image-editor-provider"
import type { Canvas as FabricCanvas } from "fabric"

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

export function ImageEditorPromptBar({
  className,
  onGenerate,
  onGeneratingChange,
}: ImageEditorPromptBarProps) {
  const { state, loadImage } = useImageEditor()
  const [prompt, setPrompt] = React.useState("")
  const [referenceFiles, setReferenceFiles] = React.useState<File[]>([])
  const [isGenerating, setIsGenerating] = React.useState(false)
  const editorInstruction = "apply the edit instructions from the image."
  const referenceInputRef = React.useRef<HTMLInputElement>(null)

  const getMaskOverlay = (canvas: FabricCanvas): MaskOverlayObject | null => {
    const overlay = canvas.getObjects().find((obj) => {
      const candidate = obj as MaskOverlayObject
      return candidate.id === "mask-overlay" || candidate.name === "Mask"
    })
    return (overlay as MaskOverlayObject | undefined) ?? null
  }

  const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    return new File([blob], filename, { type: "image/png" })
  }

  const getNonBaseOverlays = (canvas: FabricCanvas): ReferenceOverlayObject[] => {
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

    // Export composite edit guidance (base + accessories), with mask hidden.
    if (maskOverlay?.set) {
      maskOverlay.set("visible", false)
      maskOverlay.dirty = true
    }
    canvas.requestRenderAll()
    const compositeDataUrl = canvas.toDataURL({ format: "png", multiplier: 1 })

    // Export clean base by hiding all non-base overlays.
    nonBaseOverlays.forEach((overlay) => {
      overlay.set?.("visible", false)
      overlay.dirty = true
    })

    canvas.requestRenderAll()

    const baseDataUrl = canvas.toDataURL({ format: "png", multiplier: 1 })

    // Restore editor view.
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
        formData.append("aspect_ratio", "match_input_image")

        if (exports?.baseDataUrl) {
          const baseFile = await dataUrlToFile(exports.baseDataUrl, "base-image.png")
          formData.append("referenceImages", baseFile)
        } else if (state.currentImage) {
          const response = await fetch(state.currentImage)
          const blob = await response.blob()
          const file = new File([blob], "base-image.png", { type: "image/png" })
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
          const maskFile = await dataUrlToFile(exports.maskDataUrl, "mask-image.png")
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
          throw new Error("Generation failed")
        }

        const data = await response.json()

        // Load the first generated image
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

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        "bg-zinc-900/80 border border-white/10 rounded-xl backdrop-blur-md",
        className
      )}
    >
      {/* Prompt input */}
      <div className="flex-1 relative">
        <input
          ref={referenceInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleAddReferences}
          className="hidden"
          aria-label="Add reference images"
        />

        <button
          className={cn(
            "absolute left-2 bottom-2 z-10",
            "w-7 h-7 rounded-md border border-white/10 bg-zinc-900/90",
            "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          )}
          onClick={() => referenceInputRef.current?.click()}
          type="button"
          title="Add reference images"
          disabled={isGenerating}
        >
          <Plus size={14} className="mx-auto" />
        </button>

        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter prompt for image generation"
          className={cn(
            "w-full h-10 px-4 pl-12 bg-zinc-800/50 border border-white/5 rounded-lg",
            "text-sm text-zinc-200 placeholder:text-zinc-500",
            "focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50",
            "transition-colors"
          )}
          disabled={isGenerating}
        />

        {referenceFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {referenceFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="h-6 px-2 rounded-md bg-zinc-800 border border-white/10 text-[11px] text-zinc-300 flex items-center gap-1.5 max-w-[220px]"
              >
                <span className="truncate">{file.name}</span>
                <button
                  className="text-zinc-500 hover:text-zinc-200 transition-colors"
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
      </div>

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={!prompt.trim() || isGenerating}
        className={cn(
          "h-10 px-5 gap-2",
          "bg-primary hover:bg-primary/90",
          "text-primary-foreground font-medium",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <Sparkle size={18} weight="fill" />
        {isGenerating ? "Generating..." : "Generate"}
      </Button>
    </div>
  )
}
