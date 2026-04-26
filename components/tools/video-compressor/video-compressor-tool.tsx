"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle,
  DownloadSimple,
  SlidersHorizontal,
  Trash,
  UploadSimple,
  VideoCamera,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

type SelectedVideo = {
  file: File
  previewUrl: string
}

type CompressedVideo = {
  blob: Blob
  fileName: string
  previewUrl: string
  width: number
  height: number
  mimeType: string
}

const VIDEO_MIME_OPTIONS = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
]

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** unitIndex).toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return ""
  return VIDEO_MIME_OPTIONS.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? ""
}

function getCompressedFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "") || "compressed-video"
  return `${baseName}-compressed.webm`
}

function getEvenDimension(value: number) {
  return Math.max(2, Math.round(value / 2) * 2)
}

function waitForEvent<T extends Event>(
  target: EventTarget,
  eventName: string,
  errorName = "error",
) {
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(eventName, handleEvent)
      target.removeEventListener(errorName, handleError)
    }
    const handleEvent = (event: Event) => {
      cleanup()
      resolve(event as T)
    }
    const handleError = () => {
      cleanup()
      reject(new Error("The browser could not process that video"))
    }

    target.addEventListener(eventName, handleEvent, { once: true })
    target.addEventListener(errorName, handleError, { once: true })
  })
}

function captureElementStream(video: HTMLVideoElement) {
  const captureVideo = video as HTMLVideoElement & {
    captureStream?: () => MediaStream
    mozCaptureStream?: () => MediaStream
  }
  return captureVideo.captureStream?.() ?? captureVideo.mozCaptureStream?.() ?? null
}

async function compressVideo({
  sourceUrl,
  fileName,
  maxWidth,
  framesPerSecond,
  bitrate,
  onProgress,
}: {
  sourceUrl: string
  fileName: string
  maxWidth: number
  framesPerSecond: number
  bitrate: number
  onProgress: (progress: number) => void
}) {
  const mimeType = getSupportedMimeType()

  if (!mimeType || typeof MediaRecorder === "undefined") {
    throw new Error("This browser does not support local video compression yet")
  }

  const sourceVideo = document.createElement("video")
  sourceVideo.src = sourceUrl
  sourceVideo.muted = true
  sourceVideo.playsInline = true
  sourceVideo.preload = "auto"

  await waitForEvent(sourceVideo, "loadedmetadata")

  const sourceWidth = sourceVideo.videoWidth || maxWidth
  const sourceHeight = sourceVideo.videoHeight || Math.round(maxWidth * 9 / 16)
  const scale = Math.min(1, maxWidth / sourceWidth)
  const outputWidth = getEvenDimension(sourceWidth * scale)
  const outputHeight = getEvenDimension(sourceHeight * scale)
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("Your browser could not prepare the video canvas")
  }

  canvas.width = outputWidth
  canvas.height = outputHeight

  const canvasStream = canvas.captureStream(framesPerSecond)
  const sourceStream = captureElementStream(sourceVideo)
  sourceStream?.getAudioTracks().forEach((track) => canvasStream.addTrack(track))

  const recorder = new MediaRecorder(canvasStream, {
    mimeType,
    videoBitsPerSecond: bitrate,
  })
  const chunks: BlobPart[] = []

  const recordingComplete = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onerror = () => reject(new Error("Video compression failed"))
    recorder.onstop = () => {
      canvasStream.getTracks().forEach((track) => track.stop())
      sourceStream?.getTracks().forEach((track) => track.stop())
      resolve(new Blob(chunks, { type: mimeType }))
    }
  })

  let animationFrame = 0
  const drawFrame = () => {
    if (!sourceVideo.ended && !sourceVideo.paused) {
      context.drawImage(sourceVideo, 0, 0, outputWidth, outputHeight)
      if (Number.isFinite(sourceVideo.duration) && sourceVideo.duration > 0) {
        onProgress(Math.min(99, Math.round((sourceVideo.currentTime / sourceVideo.duration) * 100)))
      }
      animationFrame = window.requestAnimationFrame(drawFrame)
    }
  }

  await waitForEvent(sourceVideo, "canplay")
  const ended = waitForEvent(sourceVideo, "ended")
  recorder.start(500)
  try {
    await sourceVideo.play()
    drawFrame()
    await ended
  } finally {
    window.cancelAnimationFrame(animationFrame)
    if (recorder.state !== "inactive") recorder.stop()
  }

  const blob = await recordingComplete
  onProgress(100)

  return {
    blob,
    fileName: getCompressedFileName(fileName),
    width: outputWidth,
    height: outputHeight,
    mimeType,
  }
}

export function VideoCompressorTool() {
  const [selectedVideo, setSelectedVideo] = React.useState<SelectedVideo | null>(null)
  const [compressedVideo, setCompressedVideo] = React.useState<CompressedVideo | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [maxWidth, setMaxWidth] = React.useState(720)
  const [framesPerSecond, setFramesPerSecond] = React.useState(24)
  const [bitrate, setBitrate] = React.useState(1400)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dragCounterRef = React.useRef(0)

  React.useEffect(() => {
    return () => {
      if (selectedVideo?.previewUrl) URL.revokeObjectURL(selectedVideo.previewUrl)
      if (compressedVideo?.previewUrl) URL.revokeObjectURL(compressedVideo.previewUrl)
    }
  }, [compressedVideo?.previewUrl, selectedVideo?.previewUrl])

  const clearCompressedVideo = React.useCallback(() => {
    setCompressedVideo((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return null
    })
    setProgress(0)
  }, [])

  const selectFile = React.useCallback((file?: File | null) => {
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
    setCompressedVideo((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return null
    })
    setProgress(0)
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
    setSelectedVideo((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return null
    })
    clearCompressedVideo()
  }, [clearCompressedVideo])

  const handleCompress = React.useCallback(async () => {
    if (!selectedVideo) return

    setIsProcessing(true)
    setProgress(1)
    try {
      const result = await compressVideo({
        sourceUrl: selectedVideo.previewUrl,
        fileName: selectedVideo.file.name,
        maxWidth,
        framesPerSecond,
        bitrate: bitrate * 1000,
        onProgress: setProgress,
      })
      const previewUrl = URL.createObjectURL(result.blob)
      const nextCompressedVideo: CompressedVideo = {
        ...result,
        previewUrl,
      }

      setCompressedVideo((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
        return nextCompressedVideo
      })
      toast.success("Video compressed", {
        description: `${formatBytes(selectedVideo.file.size)} to ${formatBytes(result.blob.size)}`,
      })
    } catch (error) {
      setProgress(0)
      toast.error(error instanceof Error ? error.message : "Could not compress video")
    } finally {
      setIsProcessing(false)
    }
  }, [bitrate, framesPerSecond, maxWidth, selectedVideo])

  const handleDownload = React.useCallback(() => {
    if (!compressedVideo) return
    const link = document.createElement("a")
    link.href = compressedVideo.previewUrl
    link.download = compressedVideo.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    toast.success("Compressed video downloaded")
  }, [compressedVideo])

  const savingsPercent = selectedVideo && compressedVideo
    ? Math.max(0, Math.round((1 - compressedVideo.blob.size / selectedVideo.file.size) * 100))
    : null

  return (
    <div className="min-h-screen bg-background px-4 pb-12 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-3 w-fit gap-1.5">
              <VideoCamera className="size-3.5" weight="duotone" />
              Free local tool
            </Badge>
            <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
              Video Compressor
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Shrink short clips locally by recording a smaller WebM version in your browser. Your file never leaves the device.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/video">
              Open Video Studio
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
                  <div className="grid flex-1 gap-0 bg-muted/20 md:grid-cols-2">
                    <div className="flex min-h-[300px] flex-col border-b md:border-b-0 md:border-r">
                      <div className="border-b px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
                        Original
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
                    <div className="flex min-h-[300px] flex-col">
                      <div className="border-b px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
                        Compressed WebM
                      </div>
                      <div className="flex flex-1 items-center justify-center p-4">
                        {compressedVideo ? (
                          <video
                            src={compressedVideo.previewUrl}
                            controls
                            playsInline
                            className="max-h-[56vh] max-w-full rounded-lg bg-black"
                          />
                        ) : (
                          <div className="max-w-xs text-center text-sm leading-6 text-muted-foreground">
                            Compression runs in real time, so a 20 second clip takes about 20 seconds.
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
                    <SlidersHorizontal className="size-4" />
                    Compression settings
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Smaller width, frame rate, and bitrate reduce file size.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-medium text-muted-foreground">Max width</label>
                    <span className="text-xs font-semibold">{maxWidth}px</span>
                  </div>
                  <Slider value={[maxWidth]} min={360} max={1080} step={40} onValueChange={([value]) => setMaxWidth(value ?? 720)} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-medium text-muted-foreground">Frame rate</label>
                    <span className="text-xs font-semibold">{framesPerSecond} fps</span>
                  </div>
                  <Slider
                    value={[framesPerSecond]}
                    min={12}
                    max={30}
                    step={1}
                    onValueChange={([value]) => setFramesPerSecond(value ?? 24)}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-medium text-muted-foreground">Bitrate</label>
                    <span className="text-xs font-semibold">{bitrate} kbps</span>
                  </div>
                  <Slider value={[bitrate]} min={500} max={4000} step={100} onValueChange={([value]) => setBitrate(value ?? 1400)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Original</p>
                    <p className="mt-1 text-sm font-semibold">
                      {selectedVideo ? formatBytes(selectedVideo.file.size) : "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Compressed</p>
                    <p className="mt-1 text-sm font-semibold">
                      {compressedVideo ? formatBytes(compressedVideo.blob.size) : "-"}
                    </p>
                  </div>
                </div>

                {isProcessing ? (
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-muted-foreground">Recording compressed clip</span>
                      <span className="font-semibold">{progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ) : null}

                {compressedVideo ? (
                  <div className="rounded-lg border border-primary/40 bg-primary/10 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CheckCircle className="size-4 text-primary" weight="fill" />
                      {savingsPercent}% smaller
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {compressedVideo.width} x {compressedVideo.height} - WebM
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <Button onClick={handleCompress} disabled={!selectedVideo || isProcessing}>
                    <VideoCamera className="mr-2 size-4" weight="duotone" />
                    {isProcessing ? "Compressing..." : compressedVideo ? "Compress again" : "Compress video"}
                  </Button>
                  <Button variant="outline" onClick={handleDownload} disabled={!compressedVideo || isProcessing}>
                    <DownloadSimple className="mr-2 size-4" />
                    Download compressed video
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-lg border bg-muted/20 p-4 text-xs leading-5 text-muted-foreground">
              Output is WebM because it can be encoded by modern browsers without a server. Very large videos may take a while.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
