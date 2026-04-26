"use client"

/* eslint-disable @next/next/no-img-element -- Blob URL previews are local browser objects. */

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle,
  DownloadSimple,
  ImageSquare,
  SlidersHorizontal,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

type SelectedImage = {
  file: File
  previewUrl: string
}

type OutputMimeType = "image/jpeg" | "image/webp" | "image/png"

type CompressedImage = {
  blob: Blob
  fileName: string
  previewUrl: string
  width: number
  height: number
  mimeType: OutputMimeType
}

const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/avif"
const OUTPUT_TYPES: Array<{ label: string; value: OutputMimeType; extension: string }> = [
  { label: "JPEG", value: "image/jpeg", extension: "jpg" },
  { label: "WebP", value: "image/webp", extension: "webp" },
  { label: "PNG", value: "image/png", extension: "png" },
]

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** unitIndex).toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatMimeType(mimeType: string) {
  return mimeType.replace("image/", "").toUpperCase()
}

function getCompressedFileName(fileName: string, mimeType: OutputMimeType) {
  const outputType = OUTPUT_TYPES.find((type) => type.value === mimeType) ?? OUTPUT_TYPES[0]
  const baseName = fileName.replace(/\.[^.]+$/, "") || "compressed-image"
  return `${baseName}-compressed.${outputType.extension}`
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Could not load that image"))
    image.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: OutputMimeType, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not compress the image"))
          return
        }
        resolve(blob)
      },
      mimeType,
      mimeType === "image/png" ? undefined : quality,
    )
  })
}

export function ImageCompressorTool() {
  const [selectedImage, setSelectedImage] = React.useState<SelectedImage | null>(null)
  const [compressedImage, setCompressedImage] = React.useState<CompressedImage | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [quality, setQuality] = React.useState(78)
  const [maxDimension, setMaxDimension] = React.useState(1600)
  const [outputMimeType, setOutputMimeType] = React.useState<OutputMimeType>("image/jpeg")
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dragCounterRef = React.useRef(0)

  React.useEffect(() => {
    return () => {
      if (selectedImage?.previewUrl) URL.revokeObjectURL(selectedImage.previewUrl)
      if (compressedImage?.previewUrl) URL.revokeObjectURL(compressedImage.previewUrl)
    }
  }, [compressedImage?.previewUrl, selectedImage?.previewUrl])

  const clearCompressedImage = React.useCallback(() => {
    setCompressedImage((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return null
    })
  }, [])

  const selectFile = React.useCallback((file?: File | null) => {
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file")
      return
    }

    if (file.type === "image/svg+xml" || file.type === "image/gif") {
      toast.error("Animated and SVG images are not supported yet")
      return
    }

    setSelectedImage((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return {
        file,
        previewUrl: URL.createObjectURL(file),
      }
    })
    setCompressedImage((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return null
    })
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

  const handleRemove = React.useCallback(() => {
    setSelectedImage((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return null
    })
    clearCompressedImage()
  }, [clearCompressedImage])

  const handleCompress = React.useCallback(async () => {
    if (!selectedImage) return

    setIsProcessing(true)
    try {
      const image = await loadImage(selectedImage.previewUrl)
      const longestSide = Math.max(image.naturalWidth, image.naturalHeight)
      const scale = Math.min(1, maxDimension / longestSide)
      const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale))
      const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale))
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")

      if (!context) {
        throw new Error("Your browser could not prepare the image canvas")
      }

      canvas.width = targetWidth
      canvas.height = targetHeight
      context.drawImage(image, 0, 0, targetWidth, targetHeight)

      const blob = await canvasToBlob(canvas, outputMimeType, quality / 100)
      const previewUrl = URL.createObjectURL(blob)
      const nextCompressedImage: CompressedImage = {
        blob,
        previewUrl,
        width: targetWidth,
        height: targetHeight,
        mimeType: outputMimeType,
        fileName: getCompressedFileName(selectedImage.file.name, outputMimeType),
      }

      setCompressedImage((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
        return nextCompressedImage
      })
      toast.success("Image compressed", {
        description: `${formatBytes(selectedImage.file.size)} to ${formatBytes(blob.size)}`,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not compress image")
    } finally {
      setIsProcessing(false)
    }
  }, [maxDimension, outputMimeType, quality, selectedImage])

  const handleDownload = React.useCallback(() => {
    if (!compressedImage) return
    const link = document.createElement("a")
    link.href = compressedImage.previewUrl
    link.download = compressedImage.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    toast.success("Compressed image downloaded")
  }, [compressedImage])

  const savingsPercent = selectedImage && compressedImage
    ? Math.max(0, Math.round((1 - compressedImage.blob.size / selectedImage.file.size) * 100))
    : null

  return (
    <div className="min-h-screen bg-background px-4 pb-12 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-3 w-fit gap-1.5">
              <ImageSquare className="size-3.5" weight="duotone" />
              Free local tool
            </Badge>
            <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
              Image Compressor
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Resize and compress PNG, JPEG, WebP, or AVIF images in your browser. No upload, no credits, no waiting on a server.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/free-tools/metadata-remover">
              Clean metadata
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card
            className={cn(
              "overflow-hidden border-dashed transition-colors",
              isDragging && "border-primary bg-primary/10",
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
          >
            <CardContent className="flex min-h-[520px] flex-col p-0">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES}
                className="hidden"
                onChange={handleFileInput}
              />

              {selectedImage ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex items-center justify-between gap-3 border-b p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {selectedImage.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatMimeType(selectedImage.file.type)} - {formatBytes(selectedImage.file.size)}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleRemove} aria-label="Remove image">
                      <Trash className="size-4" />
                    </Button>
                  </div>
                  <div className="grid flex-1 gap-0 bg-muted/20 md:grid-cols-2">
                    <div className="flex min-h-[300px] flex-col border-b md:border-b-0 md:border-r">
                      <div className="border-b px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
                        Original
                      </div>
                      <div className="flex flex-1 items-center justify-center p-4">
                        <img
                          src={selectedImage.previewUrl}
                          alt="Original image preview"
                          className="max-h-[56vh] max-w-full rounded-lg object-contain"
                        />
                      </div>
                    </div>
                    <div className="flex min-h-[300px] flex-col">
                      <div className="border-b px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
                        Compressed
                      </div>
                      <div className="flex flex-1 items-center justify-center p-4">
                        {compressedImage ? (
                          <img
                            src={compressedImage.previewUrl}
                            alt="Compressed image preview"
                            className="max-h-[56vh] max-w-full rounded-lg object-contain"
                          />
                        ) : (
                          <div className="max-w-xs text-center text-sm leading-6 text-muted-foreground">
                            Adjust the settings, then compress to preview the smaller file.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="flex size-16 items-center justify-center rounded-full border bg-muted text-foreground">
                    <UploadSimple className="size-7" weight="duotone" />
                  </span>
                  <span className="max-w-md">
                    <span className="block text-lg font-semibold text-foreground">
                      Drop or choose an image
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                      PNG, JPEG, WebP, and AVIF are supported.
                    </span>
                  </span>
                </button>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-5">
            <Card>
              <CardContent className="space-y-5 p-5">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <SlidersHorizontal className="size-4" />
                    Compression settings
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Lower quality and smaller dimensions create lighter files.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-medium text-muted-foreground">Quality</label>
                    <span className="text-xs font-semibold">{quality}%</span>
                  </div>
                  <Slider value={[quality]} min={35} max={95} step={1} onValueChange={([value]) => setQuality(value ?? 78)} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-medium text-muted-foreground">Max side</label>
                    <span className="text-xs font-semibold">{maxDimension}px</span>
                  </div>
                  <Slider
                    value={[maxDimension]}
                    min={640}
                    max={3000}
                    step={40}
                    onValueChange={([value]) => setMaxDimension(value ?? 1600)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {OUTPUT_TYPES.map((type) => (
                    <Button
                      key={type.value}
                      type="button"
                      variant={outputMimeType === type.value ? "default" : "outline"}
                      className="h-9 px-2 text-xs"
                      onClick={() => setOutputMimeType(type.value)}
                    >
                      {type.label}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Original</p>
                    <p className="mt-1 text-sm font-semibold">
                      {selectedImage ? formatBytes(selectedImage.file.size) : "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Compressed</p>
                    <p className="mt-1 text-sm font-semibold">
                      {compressedImage ? formatBytes(compressedImage.blob.size) : "-"}
                    </p>
                  </div>
                </div>

                {compressedImage ? (
                  <div className="rounded-lg border border-primary/40 bg-primary/10 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CheckCircle className="size-4 text-primary" weight="fill" />
                      {savingsPercent}% smaller
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {compressedImage.width} x {compressedImage.height} - {formatMimeType(compressedImage.mimeType)}
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <Button onClick={handleCompress} disabled={!selectedImage || isProcessing}>
                    <ImageSquare className="mr-2 size-4" weight="duotone" />
                    {isProcessing ? "Compressing..." : compressedImage ? "Compress again" : "Compress image"}
                  </Button>
                  <Button variant="outline" onClick={handleDownload} disabled={!compressedImage}>
                    <DownloadSimple className="mr-2 size-4" />
                    Download compressed image
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-lg border bg-muted/20 p-4 text-xs leading-5 text-muted-foreground">
              Files stay in your browser. JPEG and WebP quality settings are strongest for file-size savings.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
