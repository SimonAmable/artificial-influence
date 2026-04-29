"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle,
  DownloadSimple,
  MagicWand,
  ShieldCheck,
  Trash,
  UploadSimple,
  VideoCamera,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type SelectedVideo = {
  file: File
  previewUrl: string
}

type FixedVideo = {
  blob: Blob
  fileName: string
  previewUrl: string
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** unitIndex).toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function parseFileNameFromDisposition(disposition: string | null, fallback: string) {
  if (!disposition) return fallback

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return fallback
    }
  }

  const plainMatch = disposition.match(/filename="([^"]+)"/i)
  return plainMatch?.[1]?.trim() || fallback
}

export function TikTokVideoFixerTool() {
  const [selectedVideo, setSelectedVideo] = React.useState<SelectedVideo | null>(null)
  const [fixedVideo, setFixedVideo] = React.useState<FixedVideo | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [serverMessage, setServerMessage] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dragCounterRef = React.useRef(0)

  React.useEffect(() => {
    return () => {
      if (selectedVideo?.previewUrl) URL.revokeObjectURL(selectedVideo.previewUrl)
      if (fixedVideo?.previewUrl) URL.revokeObjectURL(fixedVideo.previewUrl)
    }
  }, [fixedVideo?.previewUrl, selectedVideo?.previewUrl])

  const clearFixedVideo = React.useCallback(() => {
    setFixedVideo((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return null
    })
    setServerMessage(null)
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
    clearFixedVideo()
  }, [clearFixedVideo])

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
    clearFixedVideo()
  }, [clearFixedVideo])

  const handleFix = React.useCallback(async () => {
    if (!selectedVideo) return

    setIsProcessing(true)
    setServerMessage(null)
    try {
      const formData = new FormData()
      formData.append("file", selectedVideo.file)

      const response = await fetch("/api/free-tools/tiktok-video-fixer", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        let errorMessage = "Could not convert the video"
        try {
          const payload = (await response.json()) as { error?: string }
          errorMessage = payload.error || errorMessage
        } catch {
          // keep fallback
        }
        throw new Error(errorMessage)
      }

      const blob = await response.blob()
      const fileName = parseFileNameFromDisposition(
        response.headers.get("Content-Disposition"),
        `${selectedVideo.file.name.replace(/\.[^.]+$/, "") || "video"}-tiktok.mp4`,
      )
      const previewUrl = URL.createObjectURL(blob)

      setFixedVideo((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
        return {
          blob,
          fileName,
          previewUrl,
        }
      })
      setServerMessage(response.headers.get("X-TikTok-Compatibility-Profile"))
      toast.success("TikTok-compatible MP4 ready")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not convert the video"
      setServerMessage(message)
      toast.error(message)
    } finally {
      setIsProcessing(false)
    }
  }, [selectedVideo])

  const handleDownload = React.useCallback(() => {
    if (!fixedVideo) return
    const link = document.createElement("a")
    link.href = fixedVideo.previewUrl
    link.download = fixedVideo.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }, [fixedVideo])

  const savingsPercent = selectedVideo && fixedVideo
    ? Math.round((1 - fixedVideo.blob.size / selectedVideo.file.size) * 100)
    : null

  return (
    <div className="min-h-screen bg-background px-4 pb-12 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-3 w-fit gap-1.5">
              <ShieldCheck className="size-3.5" weight="duotone" />
              Free TikTok fixer
            </Badge>
            <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
              TikTok Video Fixer
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Re-encode a clip into a safer TikTok upload profile when you hit <span className="font-mono">file_format_check_failed</span>.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/autopost">
              Open Autopost
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
                        Fixed MP4
                      </div>
                      <div className="flex flex-1 items-center justify-center p-4">
                        {fixedVideo ? (
                          <video
                            src={fixedVideo.previewUrl}
                            controls
                            playsInline
                            className="max-h-[56vh] max-w-full rounded-lg bg-black"
                          />
                        ) : (
                          <div className="max-w-xs text-center text-sm leading-6 text-muted-foreground">
                            The converter forces a conservative TikTok-friendly MP4 profile with H.264 video and AAC audio.
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
                      Best for clips that TikTok rejected with a format error.
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
                    <MagicWand className="size-4" />
                    What it changes
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Server-side FFmpeg conversion to a safer upload profile.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Original</p>
                    <p className="mt-1 text-sm font-semibold">
                      {selectedVideo ? formatBytes(selectedVideo.file.size) : "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Fixed</p>
                    <p className="mt-1 text-sm font-semibold">
                      {fixedVideo ? formatBytes(fixedVideo.blob.size) : "-"}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-4 text-xs leading-5 text-muted-foreground">
                  <p className="font-semibold text-foreground">Output profile</p>
                  <p className="mt-1">MP4 container, H.264 video, AAC audio, yuv420p pixel format, faststart enabled.</p>
                </div>

                {fixedVideo ? (
                  <div className="rounded-lg border border-primary/40 bg-primary/10 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CheckCircle className="size-4 text-primary" weight="fill" />
                      Converted successfully
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {typeof savingsPercent === "number"
                        ? `${Math.abs(savingsPercent)}% ${savingsPercent >= 0 ? "smaller" : "larger"} than the original`
                        : serverMessage || "TikTok-compatible MP4 ready"}
                    </p>
                  </div>
                ) : serverMessage ? (
                  <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                    {serverMessage}
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <Button onClick={handleFix} disabled={!selectedVideo || isProcessing}>
                    <VideoCamera className="mr-2 size-4" weight="duotone" />
                    {isProcessing ? "Fixing video..." : fixedVideo ? "Fix again" : "Make TikTok-compatible MP4"}
                  </Button>
                  <Button variant="outline" onClick={handleDownload} disabled={!fixedVideo || isProcessing}>
                    <DownloadSimple className="mr-2 size-4" />
                    Download fixed video
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-lg border bg-muted/20 p-4 text-xs leading-5 text-muted-foreground">
              If your clip still fails after this, the next things to check are duration limits, private URL access, or an upload that times out before TikTok finishes fetching it.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
