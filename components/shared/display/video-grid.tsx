"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

interface GeneratedVideo {
  url: string
  model: string
  timestamp: number
  parameters: Record<string, unknown>
}

interface VideoGridProps {
  videos: GeneratedVideo[]
  isGenerating?: boolean
  className?: string
}

export function VideoGrid({
  videos,
  isGenerating = false,
  className,
}: VideoGridProps) {
  const [columnCount, setColumnCount] = React.useState(3) // Default 3 columns for videos

  // Grid column class mapping
  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[columnCount] || 'grid-cols-3'

  // Gap class mapping
  const gapClass = {
    1: 'gap-3 sm:gap-4 md:gap-6',
    2: 'gap-2 sm:gap-3 md:gap-4',
    3: 'gap-1.5 sm:gap-2 md:gap-3',
    4: 'gap-1.5 sm:gap-2 md:gap-3',
  }[columnCount] || 'gap-1.5 sm:gap-2 md:gap-3'

  return (
    <div className={cn("w-full h-full flex flex-col py-0", className)}>
      {/* Column Count Slider */}
      <div className="p-3 sm:p-4 pb-3 sm:pb-4">
        <div className="flex items-center justify-end gap-3 sm:gap-4 w-full">
          <label className="text-xs sm:text-sm font-medium whitespace-nowrap text-foreground">
            Columns: <span className="text-primary">{columnCount}</span>
          </label>
          <Slider
            value={[columnCount]}
            onValueChange={(value) => setColumnCount(value[0])}
            min={1}
            max={4}
            step={1}
            className="w-24 sm:w-32"
          />
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 min-h-0 p-0 pt-0">
        <div 
          className={cn(
            "grid p-2 overflow-auto h-full",
            gridColsClass,
            gapClass,
            "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          )}
          style={{
            gridAutoRows: 'auto',
            gridAutoFlow: 'row',
          }}
        >
          {/* Generating card - appears first (top-left) when generating */}
          {isGenerating && (
            <div className="relative aspect-video w-full overflow-hidden bg-zinc-900 rounded-lg">
              {/* White fading line animation - 2 minute infinite duration */}
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-zinc-800 to-zinc-700"
                style={{
                  width: '0%',
                  animation: 'fillProgress 120s linear infinite',
                  boxShadow: '2px 0 8px 0 rgba(255, 255, 255, 0.4)'
                }}
              />
              {/* Overlay gradient for depth */}
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/30 via-transparent to-zinc-900/30 pointer-events-none" />
              <style jsx>{`
                @keyframes fillProgress {
                  0% {
                    width: 0%;
                  }
                  100% {
                    width: 100%;
                  }
                }
              `}</style>
            </div>
          )}
          
          {/* Render existing videos */}
          {videos.map((video, index) => (
            <div
              key={`video-${index}-${video.timestamp}`}
              className="relative aspect-video w-full overflow-hidden rounded-lg"
            >
              <video
                src={video.url}
                controls
                className="w-full h-full object-cover"
                playsInline
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 hover:opacity-100 transition-opacity">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium truncate">{video.model}</p>
                    <p className="text-xs text-white/70">
                      {new Date(video.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white/20 h-8 px-2"
                    asChild
                  >
                    <a href={video.url} download>
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
