"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle,
  DownloadSimple,
  FrameCorners,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  extractFirstFrame,
  extractLastFrame,
  type ExtractedFrame,
} from "@/lib/canvas/frame-extraction"
import { cn } from "@/lib/utils"

type SelectedVideo = {
  file: File
  previewUrl: string
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** unitIndex).toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function getBaseFilename(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || "video"
}

function downloadFrame(frame: ExtractedFrame) {
  const link = document.createElement("a")
  link.href = frame.url
  link.download = frame.filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function VideoFrameExtractorTool() {
  const [selectedVideo, setSelectedVideo] = React.useState<SelectedVideo | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [processingTarget, setProcessingTarget] = React.useState<"first" | "last" | null>(null)
  const [firstFrame, setFirstFrame] = React.useState<ExtractedFrame | null>(null)
  const [lastFrame, setLastFrame] = React.useState<ExtractedFrame | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dragCounterRef = React.useRef(0)

  const revokeFrame = React.useCallback((frame: ExtractedFrame | null) => {
    if (frame?.url) URL.revokeObjectURL(frame.url)
  }, [])

  React.useEffect(() => {
    return () => {
      if (selectedVideo?.previewUrl) URL.revokeObjectURL(selectedVideo.previewUrl)
      revokeFrame(firstFrame)
      revokeFrame(lastFrame)
    }
  }, [firstFrame, lastFrame, revokeFrame, selectedVideo?.previewUrl])

  const clearFrames = React.useCallback(() => {
    setFirstFrame((current) => {
      revokeFrame(current)
      return null
    })
    setLastFrame((current) => {
      revokeFrame(current)
      return null
    })
  }, [revokeFrame])

  const selectFile = React.useCallback(
    (file?: File | null) => {
      if (!file) return

      if (!file.type.startsWith("video/")) {
        toast.error("Please choose a video file")
        return
      }

      setSelectedVideo((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
        return {
          file,
          previewUrl: URL.createObjectURL(file),
        }
      })
      clearFrames()
    },
    [clearFrames],
  )

  const handleFileInput = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      selectFile(event.target.files?.[0] ?? null)
      event.target.value = ""
    },
    [selectFile],
  )

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      dragCounterRef.current = 0
      setIsDragging(false)
      selectFile(event.dataTransfer.files?.[0] ?? null)
    },
    [selectFile],
  )

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
    setSelectedVideo((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return null
    })
    clearFrames()
  }, [clearFrames])

  const handleExtract = React.useCallback(
    async (target: "first" | "last") => {
      if (!selectedVideo) return

      setIsProcessing(true)
      setProcessingTarget(target)
      try {
        const baseFilename = getBaseFilename(selectedVideo.file.name)
        const frame =
          target === "first"
            ? await extractFirstFrame(selectedVideo.previewUrl, baseFilename)
            : await extractLastFrame(selectedVideo.previewUrl, baseFilename)

        if (target === "first") {
          setFirstFrame((current) => {
            revokeFrame(current)
            return frame
          })
        } else {
          setLastFrame((current) => {
            revokeFrame(current)
            return frame
          })
        }

        toast.success(target === "first" ? "First frame extracted" : "Last frame extracted", {
          description: `${frame.width} x ${frame.height} PNG`,
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not extract frame")
      } finally {
        setIsProcessing(false)
        setProcessingTarget(null)
      }
    },
    [revokeFrame, selectedVideo],
  )

  const handleExtractBoth = React.useCallback(async () => {
    if (!selectedVideo) return

    setIsProcessing(true)
    setProcessingTarget("first")
    try {
      const baseFilename = getBaseFilename(selectedVideo.file.name)
      const [first, last] = await Promise.all([
        extractFirstFrame(selectedVideo.previewUrl, baseFilename),
        extractLastFrame(selectedVideo.previewUrl, baseFilename),
      ])

      setFirstFrame((current) => {
        revokeFrame(current)
        return first
      })
      setLastFrame((current) => {
        revokeFrame(current)
        return last
      })

      toast.success("First and last frames extracted", {
        description: `${first.width} x ${first.height} PNG each`,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not extract frames")
    } finally {
      setIsProcessing(false)
      setProcessingTarget(null)
    }
  }, [revokeFrame, selectedVideo])

  const handleDownload = React.useCallback((frame: ExtractedFrame, label: string) => {
    downloadFrame(frame)
    toast.success(`${label} downloaded`)
  }, [])

  const hasAnyFrame = Boolean(firstFrame || lastFrame)

  return (
    <div className="min-h-screen bg-background px-4 pb-12 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-3 w-fit gap-1.5">
              <FrameCorners className="size-3.5" weight="regular" />
              Free local tool
            </Badge>
            <h1 className="text-3xl font-bold leading-tight sm:text-5xl">Video Frame Extractor</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Pull the first or last frame from any short clip as a PNG still. Processing happens in
              your browser — the video never leaves your device.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/free-tools">
              All tools
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
                accept="video/*"
                className="hidden"
                onChange={handleFileInput}
              />

              {selectedVideo ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex items-center justify-between gap-3 border-b p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {selectedVideo.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedVideo.file.type || "Video"} - {formatBytes(selectedVideo.file.size)}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleRemove} aria-label="Remove video">
                      <Trash className="size-4" />
                    </Button>
                  </div>

                  <div
                    className={cn(
                      "grid flex-1 gap-0 bg-muted/20",
                      hasAnyFrame ? "md:grid-cols-2" : "grid-cols-1",
                    )}
                  >
                    <div className="flex min-h-[280px] flex-col border-b md:border-b-0 md:border-r">
                      <div className="border-b px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
                        Source video
                      </div>
                      <div className="flex flex-1 items-center justify-center p-4">
                        <video
                          src={selectedVideo.previewUrl}
                          controls
                          playsInline
                          className="max-h-[56vh] max-w-full rounded-lg bg-black"
                        />
                      </div>
                    </div>

                    {hasAnyFrame ? (
                      <div className="flex min-h-[280px] flex-col">
                        <div className="border-b px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
                          Extracted frames
                        </div>
                        <div className="grid flex-1 gap-0 sm:grid-cols-2">
                          {firstFrame ? (
                            <div className="flex flex-col border-b sm:border-b-0 sm:border-r">
                              <div className="border-b px-3 py-2 text-[11px] font-medium text-muted-foreground">
                                First frame
                              </div>
                              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
                                <img
                                  src={firstFrame.url}
                                  alt="First frame"
                                  className="max-h-[40vh] max-w-full rounded-lg border bg-black object-contain"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownload(firstFrame, "First frame")}
                                >
                                  <DownloadSimple className="mr-2 size-4" />
                                  Download
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          {lastFrame ? (
                            <div className="flex flex-col">
                              <div className="border-b px-3 py-2 text-[11px] font-medium text-muted-foreground">
                                Last frame
                              </div>
                              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
                                <img
                                  src={lastFrame.url}
                                  alt="Last frame"
                                  className="max-h-[40vh] max-w-full rounded-lg border bg-black object-contain"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownload(lastFrame, "Last frame")}
                                >
                                  <DownloadSimple className="mr-2 size-4" />
                                  Download
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-[200px] items-center justify-center border-t p-8 text-center text-sm leading-6 text-muted-foreground md:border-t-0 md:border-l">
                        Choose first frame, last frame, or both from the panel on the right.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="flex size-16 items-center justify-center rounded-full border bg-muted text-foreground">
                    <UploadSimple className="size-7" weight="regular" />
                  </span>
                  <span className="max-w-md">
                    <span className="block text-lg font-semibold text-foreground">
                      Drop or choose a video
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                      MP4, MOV, and WebM support depends on your browser decoder.
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
                    <FrameCorners className="size-4" />
                    Extract frames
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Useful for first/last-frame video models, motion copy prep, or storyboard stills.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">First frame</p>
                    <p className="mt-1 text-sm font-semibold">
                      {firstFrame ? `${firstFrame.width} x ${firstFrame.height}` : "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Last frame</p>
                    <p className="mt-1 text-sm font-semibold">
                      {lastFrame ? `${lastFrame.width} x ${lastFrame.height}` : "-"}
                    </p>
                  </div>
                </div>

                {hasAnyFrame ? (
                  <div className="rounded-lg border border-primary/40 bg-primary/10 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CheckCircle className="size-4 text-primary" weight="fill" />
                      {[firstFrame && "First", lastFrame && "Last"].filter(Boolean).join(" and ")}{" "}
                      frame ready
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">PNG output, full resolution</p>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => handleExtract("first")}
                    disabled={!selectedVideo || isProcessing}
                  >
                    <FrameCorners className="mr-2 size-4" weight="regular" />
                    {isProcessing && processingTarget === "first"
                      ? "Extracting first frame..."
                      : firstFrame
                        ? "Re-extract first frame"
                        : "Extract first frame"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleExtract("last")}
                    disabled={!selectedVideo || isProcessing}
                  >
                    <FrameCorners className="mr-2 size-4" weight="regular" />
                    {isProcessing && processingTarget === "last"
                      ? "Extracting last frame..."
                      : lastFrame
                        ? "Re-extract last frame"
                        : "Extract last frame"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExtractBoth}
                    disabled={!selectedVideo || isProcessing}
                  >
                    Extract both frames
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-lg border bg-muted/20 p-4 text-xs leading-5 text-muted-foreground">
              Last-frame capture seeks slightly before the end so browsers can decode the final
              visible frame. For exact frame-accurate exports, use the chat agent&apos;s ffmpeg
              extraction tool.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
