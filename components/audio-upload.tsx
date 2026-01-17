"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { X, Play, Pause, Plus, Waveform, FileArrowUp, Microphone } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { GenerateVoiceDialog } from "./generate-voice-dialog"

export interface AudioUploadValue {
  url?: string
  file?: File
}

export interface AudioUploadProps {
  value?: AudioUploadValue | null
  onChange?: (audio: AudioUploadValue | null) => void
  className?: string
  title?: string
  description?: string
  accept?: string
  maxHeight?: string
  minHeight?: string
}

export function AudioUpload({
  value,
  onChange,
  className,
  title = "Input Audio",
  description = "Click to upload audio",
  accept = "audio/*",
  maxHeight = "max-h-[45px]",
  minHeight = "min-h-[50px] sm:min-h-[55px]",
}: AudioUploadProps) {
  const [generateDialogOpen, setGenerateDialogOpen] = React.useState(false)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [waveformData, setWaveformData] = React.useState<number[]>([])
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const animationFrameRef = React.useRef<number | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  // Generate waveform data from audio file
  const generateWaveform = React.useCallback(async (audioFile: File) => {
    try {
      const arrayBuffer = await audioFile.arrayBuffer()
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      
      const rawData = audioBuffer.getChannelData(0) // Get first channel
      const samples = 100 // Number of bars in waveform
      const blockSize = Math.floor(rawData.length / samples)
      const filteredData: number[] = []
      
      for (let i = 0; i < samples; i++) {
        let sum = 0
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[i * blockSize + j])
        }
        filteredData.push(sum / blockSize)
      }
      
      // Normalize to 0-1 range
      const max = Math.max(...filteredData)
      const normalized = filteredData.map(val => (val / max) * 0.8 + 0.1) // Scale to 0.1-0.9
      setWaveformData(normalized)
      
      audioContext.close()
    } catch (error) {
      console.error("Error generating waveform:", error)
      // Fallback: generate simple waveform
      setWaveformData(new Array(100).fill(0.5))
    }
  }, [])

  // Draw waveform on canvas
  const drawWaveform = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || waveformData.length === 0) return
    
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    
    const width = canvas.width
    const height = canvas.height
    const barWidth = width / waveformData.length
    const barGap = barWidth * 0.3
    const actualBarWidth = barWidth - barGap
    
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = "hsl(var(--primary))"
    
    waveformData.forEach((value, index) => {
      const barHeight = value * height
      const x = index * barWidth + barGap / 2
      const y = (height - barHeight) / 2
      
      ctx.fillRect(x, y, actualBarWidth, barHeight)
    })
  }, [waveformData])

  // Update waveform drawing when data changes
  React.useEffect(() => {
    if (waveformData.length > 0) {
      drawWaveform()
    }
  }, [waveformData, drawWaveform])

  // Update canvas size
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      }
      
      drawWaveform()
    }
    
    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)
    return () => window.removeEventListener("resize", resizeCanvas)
  }, [drawWaveform])

  // Handle audio playback
  const handlePlayPause = () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    } else {
      audioRef.current.play()
      setIsPlaying(true)
      updateProgress()
    }
  }

  // Update progress bar
  const updateProgress = () => {
    if (!audioRef.current) return
    
    const update = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime)
        if (!audioRef.current.paused) {
          animationFrameRef.current = requestAnimationFrame(update)
        }
      }
    }
    update()
  }

  // Handle audio loaded
  const handleAudioLoaded = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  // Handle audio ended
  const handleAudioEnded = () => {
    setIsPlaying(false)
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      setCurrentTime(0)
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }

  // Handle file upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      const newAudio = { file, url }
      onChange?.(newAudio)
      await generateWaveform(file)
    }
  }

  // Handle remove
  const handleRemove = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
    }
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setWaveformData([])
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    onChange?.(null)
  }

  // Generate waveform when value changes
  React.useEffect(() => {
    if (value?.file && !waveformData.length) {
      generateWaveform(value.file)
    }
  }, [value?.file, generateWaveform, waveformData.length])

  // Cleanup
  React.useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ""
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <Card className={cn("relative bg-muted border-dashed border-2 border-muted-foreground/40 rounded-lg h-full py-0", className)}>
      <CardContent className={cn("p-1.5 sm:p-2 h-full flex items-center justify-center", minHeight)}>
        {value?.url ? (
          <div className="relative group flex flex-col items-center justify-center w-full h-full min-h-[45px] p-1 gap-1">
            {/* Audio player */}
            <audio
              ref={audioRef}
              src={value.url}
              onLoadedMetadata={handleAudioLoaded}
              onEnded={handleAudioEnded}
              preload="metadata"
            />
            
            {/* Waveform canvas */}
            <div className="relative w-full h-8 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ maxHeight: "32px" }}
              />
              {/* Progress indicator */}
              {duration > 0 && (
                <div
                  className="absolute left-0 top-0 h-full bg-primary/20 pointer-events-none"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              )}
            </div>
            
            {/* Controls */}
            <div className="flex items-center gap-2 w-full justify-center">
              <button
                onClick={handlePlayPause}
                className="bg-background/80 hover:bg-background rounded-full p-1.5 transition-colors"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="size-3 sm:size-4" />
                ) : (
                  <Play className="size-3 sm:size-4" />
                )}
              </button>
              {duration > 0 && (
                <span className="text-[8px] sm:text-[9px] text-muted-foreground">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              )}
            </div>
            
            {/* Remove button */}
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 bg-background/80 hover:bg-background rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove audio"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleUpload}
              className="hidden"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex flex-col items-center justify-center gap-0.5 cursor-pointer w-full h-full"
                >
                  <div className="relative">
                    <Waveform className="size-5 sm:size-6 text-foreground" weight="bold" />
                    <Plus className="size-2 sm:size-2.5 text-foreground absolute -top-0.5 -right-0.5 bg-muted rounded-full p-0.5" weight="bold" />
                  </div>
                  <div className="flex flex-col items-center gap-0">
                    <div className="text-foreground font-bold text-[9px] sm:text-[10px]">{title}</div>
                    <div className="text-muted-foreground text-[8px] sm:text-[9px] text-center px-1">{description}</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                  <FileArrowUp className="size-4" />
                  Upload file
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setGenerateDialogOpen(true)}>
                  <Microphone className="size-4" />
                  Generate voice line
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        <GenerateVoiceDialog
          open={generateDialogOpen}
          onOpenChange={setGenerateDialogOpen}
          onSuccess={(a) => {
            onChange?.({ url: a.url })
            setGenerateDialogOpen(false)
          }}
        />
      </CardContent>
    </Card>
  )
}
