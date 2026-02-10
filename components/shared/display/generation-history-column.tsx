"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { FullscreenImageViewer } from "./fullscreen-image-viewer"
import { Button } from "@/components/ui/button"
import { CaretUp, CaretDown } from "@phosphor-icons/react"

interface ImageData {
  id?: string
  url: string
  model?: string | null
  prompt?: string | null
  tool?: string | null
  aspectRatio?: string | null
  type?: string | null
  createdAt?: string | null
}

interface GenerationHistoryColumnProps {
  images: Array<string | ImageData>
  isGenerating?: boolean
  generatingCount?: number
  isLoadingSkeleton?: boolean
  className?: string
  maxItems?: number
}

export function GenerationHistoryColumn({
  images,
  isGenerating = false,
  generatingCount = 1,
  isLoadingSkeleton = false,
  className,
  maxItems = 20,
}: GenerationHistoryColumnProps) {
  const [fullscreenImage, setFullscreenImage] = React.useState<ImageData | null>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

  const normalizedImages = React.useMemo(
    () =>
      images
        .slice(0, maxItems)
        .map((item) =>
          typeof item === "string"
            ? { id: undefined, url: item, model: null, prompt: null, tool: null, aspectRatio: null, type: null, createdAt: null }
            : { 
                id: item.id, 
                url: item.url, 
                model: item.model ?? null, 
                prompt: item.prompt ?? null,
                tool: item.tool ?? null,
                aspectRatio: item.aspectRatio ?? null,
                type: item.type ?? null,
                createdAt: item.createdAt ?? null
              }
        ),
    [images, maxItems]
  )

  const handleScrollUp = React.useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ top: -100, behavior: 'smooth' })
    }
  }, [])

  const handleScrollDown = React.useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ top: 100, behavior: 'smooth' })
    }
  }, [])

  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFullscreenImage(null)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [])

  return (
    <>
      <div 
        className={cn(
          "flex flex-col relative bg-background/50 rounded-lg border border-border",
          className
        )}
        style={{ maxHeight: '500px' }}
      >
        {/* Scroll Up Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-0 left-1/2 -translate-x-1/2 z-10 h-8 w-8 bg-background/80 hover:bg-background border border-border rounded-full"
          onClick={handleScrollUp}
          aria-label="Scroll up"
        >
          <CaretUp className="h-4 w-4" />
        </Button>

        {/* Scrollable Content */}
        <div 
          ref={scrollContainerRef}
          className={cn(
            "flex flex-col gap-2 overflow-y-auto p-2 pt-10 pb-10",
            "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          )}
        >
          {/* Skeleton loading */}
          {isLoadingSkeleton && Array.from({ length: 8 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="w-full aspect-square bg-muted/30 animate-pulse rounded-md min-h-[100px]"
            />
          ))}

          {/* Generating cards */}
          {isGenerating && !isLoadingSkeleton && Array.from({ length: generatingCount }).map((_, index) => (
            <div 
              key={`generating-${index}`} 
              className="relative w-full aspect-square overflow-hidden bg-zinc-900 rounded-md min-h-[100px]"
            >
              {/* Progress animation */}
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-zinc-800 to-zinc-700"
                style={{
                  width: '0%',
                  animation: 'fillProgress 20s linear infinite',
                  boxShadow: '2px 0 8px 0 rgba(255, 255, 255, 0.4)'
                }}
              />
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
          ))}
          
          {/* Render existing images */}
          {!isLoadingSkeleton && normalizedImages.map((image, index) => (
            <div
              key={`image-${index}-${image.url}`}
              className={cn(
                "group relative w-full aspect-square bg-background rounded-md overflow-hidden cursor-pointer min-h-[100px]",
                "hover:ring-2 hover:ring-primary transition-all duration-200"
              )}
              onClick={() => setFullscreenImage(image)}
            >
              <img
                src={image.url}
                alt={`Generation ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <div className="text-white text-xs font-medium">View</div>
              </div>
            </div>
          ))}
        </div>

        {/* Scroll Down Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10 h-8 w-8 bg-background/80 hover:bg-background border border-border rounded-full"
          onClick={handleScrollDown}
          aria-label="Scroll down"
        >
          <CaretDown className="h-4 w-4" />
        </Button>
      </div>

      {fullscreenImage && (
        <FullscreenImageViewer
          imageUrl={fullscreenImage.url}
          metadata={{
            id: fullscreenImage.id,
            model: fullscreenImage.model,
            prompt: fullscreenImage.prompt,
            tool: fullscreenImage.tool,
            aspectRatio: fullscreenImage.aspectRatio,
            type: fullscreenImage.type,
            createdAt: fullscreenImage.createdAt,
          }}
          onClose={() => setFullscreenImage(null)}
        />
      )}
    </>
  )
}
