"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle,
  DownloadSimple,
  ImageSquare,
  ShieldCheck,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  downloadBlob,
  stripImageMetadata,
  type StrippedImageResult,
} from "@/lib/images/strip-metadata"

type SelectedImage = {
  file: File
  previewUrl: string
}

const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/avif"

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** unitIndex).toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatMimeType(mimeType: string) {
  return mimeType.replace("image/", "").toUpperCase()
}

export function MetadataRemoverTool() {
  const [selectedImage, setSelectedImage] = React.useState<SelectedImage | null>(null)
  const [cleanResult, setCleanResult] = React.useState<StrippedImageResult | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dragCounterRef = React.useRef(0)

  React.useEffect(() => {
    return () => {
      if (selectedImage?.previewUrl) {
        URL.revokeObjectURL(selectedImage.previewUrl)
      }
    }
  }, [selectedImage?.previewUrl])

  const resetResult = React.useCallback(() => {
    setCleanResult(null)
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
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl)
      }
      return {
        file,
        previewUrl: URL.createObjectURL(file),
      }
    })
    setCleanResult(null)
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
    setSelectedImage(null)
    setCleanResult(null)
  }, [])

  const handleStrip = React.useCallback(async () => {
    if (!selectedImage) return

    setIsProcessing(true)
    try {
      const result = await stripImageMetadata(selectedImage.file)
      setCleanResult(result)
      toast.success("Metadata removed", {
        description: "Your clean image is ready to download.",
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove metadata")
    } finally {
      setIsProcessing(false)
    }
  }, [selectedImage])

  const handleDownload = React.useCallback(() => {
    if (!cleanResult) return
    downloadBlob(cleanResult.blob, cleanResult.fileName)
    toast.success("Clean image downloaded")
  }, [cleanResult])

  return (
    <div className="min-h-screen bg-background px-4 pb-12 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-3 w-fit gap-1.5">
              <ShieldCheck className="size-3.5" weight="duotone" />
              Free local tool
            </Badge>
            <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
              Metadata Remover
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Re-encode AI images into clean raster files in your browser. Nothing uploads, and no credits are used.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/image">
              Open Image Studio
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
                  <div className="flex flex-1 items-center justify-center bg-muted/20 p-4">
                    <img
                      src={selectedImage.previewUrl}
                      alt="Selected image preview"
                      className="max-h-[62vh] max-w-full rounded-lg object-contain"
                    />
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
                      PNG, JPEG, WebP, and AVIF are supported for this first version.
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
                  <p className="text-sm font-semibold text-foreground">Clean output</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    The clean image is created from pixels only.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Original</p>
                    <p className="mt-1 text-sm font-semibold">
                      {selectedImage ? formatBytes(selectedImage.file.size) : "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Clean</p>
                    <p className="mt-1 text-sm font-semibold">
                      {cleanResult ? formatBytes(cleanResult.blob.size) : "-"}
                    </p>
                  </div>
                </div>

                {cleanResult ? (
                  <div className="rounded-lg border border-primary/40 bg-primary/10 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CheckCircle className="size-4 text-primary" weight="fill" />
                      Ready
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {cleanResult.width} x {cleanResult.height} - {formatMimeType(cleanResult.mimeType)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ImageSquare className="size-4" />
                      Waiting for image
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Select a static image to create a clean copy.
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Button onClick={handleStrip} disabled={!selectedImage || isProcessing}>
                    <ShieldCheck className="mr-2 size-4" weight="duotone" />
                    {isProcessing ? "Removing..." : cleanResult ? "Remove again" : "Remove metadata"}
                  </Button>
                  <Button variant="outline" onClick={handleDownload} disabled={!cleanResult}>
                    <DownloadSimple className="mr-2 size-4" />
                    Download clean image
                  </Button>
                  {cleanResult ? (
                    <Button variant="ghost" onClick={resetResult}>
                      Clear output
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <div className="rounded-lg border bg-muted/20 p-4 text-xs leading-5 text-muted-foreground">
              Files stay in your browser. This tool removes embedded metadata by making a new image from the visible pixels.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
