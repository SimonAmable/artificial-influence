"use client"

import * as React from "react"
import {
  CircleNotch,
  DownloadSimple,
  Sparkle,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { ImageCompareSlider } from "@/components/shared/display/image-compare-slider"
import {
  UpscaleSettingsPopover,
  buildUpscaleRequestPayload,
  DEFAULT_UPSCALE_PAGE_SETTINGS,
  type UpscaleSettings,
} from "@/components/tools/upscale/upscale-settings-popover"
import { Button } from "@/components/ui/button"
import { downloadBlob } from "@/lib/images/strip-metadata"
import { tryShowContentModerationToast } from "@/lib/content-moderation-toast"
import { showCreditsUpsellToast } from "@/lib/pricing-upsell"
import { cn } from "@/lib/utils"

const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp"
const EXAMPLE_BEFORE_SRC = "/upscale_examples/before.png"
const EXAMPLE_AFTER_SRC = "/upscale_examples/after.png"

type SelectedImage = {
  file: File
  previewUrl: string
}

type UpscalePhase = "idle" | "preview" | "processing" | "result"

function getUpscaledFileName(originalName: string) {
  const base = originalName.replace(/\.[^.]+$/, "") || "image"
  return `upscaled-${base}.png`
}

export function UpscaleTool() {
  const [phase, setPhase] = React.useState<UpscalePhase>("idle")
  const [selectedImage, setSelectedImage] = React.useState<SelectedImage | null>(null)
  const [upscaledUrl, setUpscaledUrl] = React.useState<string | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [settings, setSettings] = React.useState<UpscaleSettings>(DEFAULT_UPSCALE_PAGE_SETTINGS)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dragCounterRef = React.useRef(0)

  React.useEffect(() => {
    return () => {
      if (selectedImage?.previewUrl) {
        URL.revokeObjectURL(selectedImage.previewUrl)
      }
    }
  }, [selectedImage?.previewUrl])

  const resetSelection = React.useCallback(() => {
    setSelectedImage((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl)
      }
      return null
    })
    setUpscaledUrl(null)
    setPhase("idle")
  }, [])

  const selectFile = React.useCallback((file?: File | null) => {
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file")
      return
    }

    if (file.type === "image/svg+xml" || file.type === "image/gif") {
      toast.error("SVG and GIF images are not supported yet")
      return
    }

    setSelectedImage((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl)
      }
      return {
        file,
        previewUrl: URL.createObjectURL(file),
      }
    })
    setUpscaledUrl(null)
    setPhase("preview")
  }, [])

  const handleFileInput = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0] ?? null)
    event.target.value = ""
  }, [selectFile])

  const handleDrop = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)
    selectFile(event.dataTransfer.files?.[0] ?? null)
  }, [selectFile])

  const handleDragOver = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const handleDragEnter = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!event.dataTransfer.types.includes("Files")) return
    dragCounterRef.current += 1
    setIsDragging(true)
  }, [])

  const handleDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragging(false)
    }
  }, [])

  const handleUpscale = React.useCallback(async () => {
    if (!selectedImage) return

    setPhase("processing")
    try {
      const form = new FormData()
      form.append("image", selectedImage.file)
      const { modelIdentifier, parameters } = buildUpscaleRequestPayload(settings)
      form.append("modelIdentifier", modelIdentifier)
      form.append("parameters", JSON.stringify(parameters))

      const res = await fetch("/api/upscale", {
        method: "POST",
        body: form,
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const msg = (data.error ?? data.message ?? "Upscale failed") as string
        if (res.status === 401) {
          toast.error("Sign in to upscale images", {
            action: {
              label: "Sign in",
              onClick: () => {
                window.location.href = "/login?next=/upscale"
              },
            },
          })
        } else if (res.status === 402) {
          showCreditsUpsellToast({
            message: msg,
            description: "Get more credits to continue",
            toastId: "upscale-credits-upsell",
          })
        } else if (!tryShowContentModerationToast(msg, undefined, { toastId: "upscale-moderation-error" })) {
          toast.error(msg)
        }
        setPhase("preview")
        return
      }

      const outputUrl = data.imageUrl as string | undefined
      if (!outputUrl) {
        toast.error("Upscale completed but no image was returned")
        setPhase("preview")
        return
      }

      setUpscaledUrl(outputUrl)
      setPhase("result")
      toast.success("Upscale complete")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upscale failed"
      console.error("Upscale error:", err)
      if (!tryShowContentModerationToast(message, err, { toastId: "upscale-moderation-error" })) {
        toast.error(message)
      }
      setPhase("preview")
    }
  }, [selectedImage, settings])

  const handleSave = React.useCallback(async () => {
    if (!upscaledUrl || !selectedImage) return

    setIsSaving(true)
    try {
      const response = await fetch(upscaledUrl)
      if (!response.ok) {
        throw new Error("Could not download upscaled image")
      }
      const blob = await response.blob()
      downloadBlob(blob, getUpscaledFileName(selectedImage.file.name))
      toast.success("Image saved")
    } catch (err) {
      console.error("Save error:", err)
      toast.error(err instanceof Error ? err.message : "Could not save image")
    } finally {
      setIsSaving(false)
    }
  }, [upscaledUrl, selectedImage])

  const openFilePicker = () => fileInputRef.current?.click()

  return (
    <main className="flex h-[calc(100dvh-52px)] max-h-[calc(100dvh-52px)] w-full items-center justify-center overflow-hidden bg-background px-4 py-4 sm:px-6">
      <div
        className={cn(
          "grid h-[min(80dvh,calc(100dvh-52px-2rem))] w-full max-w-lg grid-rows-[minmax(0,1fr)_auto_auto] items-center gap-4 overflow-hidden rounded-2xl border border-dashed border-muted-foreground/40 p-5 sm:gap-5 sm:p-6",
          isDragging && "border-primary bg-primary/5",
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          className="hidden"
          onChange={handleFileInput}
        />

        <div
          className={cn(
            "flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-2xl",
            phase === "idle" ? "bg-muted/20" : "bg-transparent",
          )}
        >
          {phase === "idle" && (
            <ImageCompareSlider
              beforeSrc={EXAMPLE_BEFORE_SRC}
              afterSrc={EXAMPLE_AFTER_SRC}
              className="h-full w-full max-h-full max-w-full rounded-2xl"
              beforeLabel="Example before"
              afterLabel="Example after"
            />
          )}

          {(phase === "preview" || phase === "processing") && selectedImage && (
            <div className="relative inline-block max-w-full">
              <img
                src={selectedImage.previewUrl}
                alt="Uploaded preview"
                className="block max-h-[calc(min(80dvh,100dvh-52px-2rem)-11rem)] max-w-full h-auto w-auto rounded-2xl"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/50">
                {phase === "processing" ? (
                  <div className="flex flex-col items-center gap-3 text-white">
                    <CircleNotch className="size-8 animate-spin" />
                    <p className="text-sm font-medium">Upscaling…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      type="button"
                      className="rounded-full bg-white px-6 text-black hover:bg-white/90"
                      onClick={handleUpscale}
                    >
                      <Sparkle className="size-4" weight="fill" />
                      Upscale
                    </Button>
                    <p className="text-xs text-white/70">1 credit</p>
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 z-10 size-8 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
                onClick={resetSelection}
                aria-label="Remove image"
              >
                <Trash className="size-4" />
              </Button>
            </div>
          )}

          {phase === "result" && selectedImage && upscaledUrl && (
            <div className="relative inline-block max-w-full">
              <img
                src={selectedImage.previewUrl}
                alt=""
                aria-hidden
                className="block max-h-[calc(min(80dvh,100dvh-52px-2rem)-11rem)] max-w-full h-auto w-auto rounded-2xl opacity-0"
              />
              <ImageCompareSlider
                beforeSrc={selectedImage.previewUrl}
                afterSrc={upscaledUrl}
                className="absolute inset-0 h-full w-full rounded-2xl"
                objectFit="contain"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 z-10 size-8 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
                onClick={resetSelection}
                aria-label="Start over"
              >
                <Trash className="size-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1.5 text-center">
          <h1 className="text-lg font-bold tracking-[0.2em] text-foreground sm:text-xl">UPSCALE</h1>
          <p className="max-w-sm text-xs text-muted-foreground sm:text-sm">
            Upload your images to enhance their resolution and quality.
          </p>
        </div>

        {phase === "idle" && (
          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              className="rounded-full bg-white px-6 text-black hover:bg-white/90"
              onClick={openFilePicker}
            >
              <UploadSimple className="size-4" weight="bold" />
              Upload Media
            </Button>
            <UpscaleSettingsPopover settings={settings} onSettingsChange={setSettings} />
          </div>
        )}

        {phase === "result" && (
          <Button
            type="button"
            className="rounded-full bg-white px-6 text-black hover:bg-white/90"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <CircleNotch className="size-4 animate-spin" />
            ) : (
              <DownloadSimple className="size-4" weight="bold" />
            )}
            Save
          </Button>
        )}

        {phase === "preview" && (
          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={openFilePicker}
            >
              Replace image
            </Button>
            <UpscaleSettingsPopover settings={settings} onSettingsChange={setSettings} />
          </div>
        )}
      </div>
    </main>
  )
}
