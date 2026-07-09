"use client"

import * as React from "react"
import Image from "next/image"
import { Image as ImageIcon, MusicNote, Play, Video } from "@phosphor-icons/react"

import type { AssetType } from "@/lib/assets/types"
import type { MediaGenerationType } from "@/components/library/history/types"

export function MediaTypeIcon({
  type,
  className,
}: {
  type: AssetType | MediaGenerationType
  className?: string
}) {
  if (type === "image") return <ImageIcon className={className} />
  if (type === "video") return <Video className={className} />
  return <MusicNote className={className} />
}

export function MediaPreview({
  type,
  url,
  playableUrl,
  alt,
  onOpen,
}: {
  type: AssetType | MediaGenerationType
  url: string
  playableUrl?: string
  alt: string
  onOpen?: () => void
}) {
  const src = playableUrl || url
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = React.useState(false)

  const togglePlay = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      void audioRef.current.play()
    }
  }

  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    return () => {
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
    }
  }, [])

  if (type === "image") {
    return (
      <button
        type="button"
        className="relative block h-full w-full overflow-hidden bg-muted text-left"
        onClick={onOpen}
      >
        <Image
          src={url}
          alt={alt}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </button>
    )
  }

  if (type === "video") {
    return (
      <button
        type="button"
        className="relative block h-full w-full overflow-hidden bg-muted text-left"
        onClick={onOpen}
      >
        <video src={src} className="h-full w-full object-cover" muted playsInline preload="metadata" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white">
            <Play className="h-5 w-5 fill-current" weight="fill" />
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-muted/40 p-4 text-center select-none">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={togglePlay}
        className="z-20 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 active:scale-95"
      >
        {isPlaying ? (
          <span className="flex h-4 items-end gap-0.5">
            <span className="h-4 w-1 animate-[pulse_0.8s_infinite] bg-current" />
            <span className="h-3 w-1 animate-[pulse_0.8s_infinite_0.2s] bg-current" />
            <span className="h-4 w-1 animate-[pulse_0.8s_infinite_0.4s] bg-current" />
          </span>
        ) : (
          <Play className="ml-0.5 h-5 w-5 fill-current text-current" weight="fill" />
        )}
      </button>
      <span className="mt-2 max-w-full truncate px-2 text-xs font-medium text-muted-foreground">
        {alt || "Audio track"}
      </span>
    </div>
  )
}
