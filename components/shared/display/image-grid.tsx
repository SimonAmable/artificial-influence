"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { ArrowsOutSimple, Copy, DownloadSimple, Check, X, DotsThree, Plus, Trash, Play, MagnifyingGlassPlus } from "@phosphor-icons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FullscreenImageViewer } from "./fullscreen-image-viewer"
import { toast } from "sonner"

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

interface ImageGridProps {
  images: Array<string | ImageData>
  isGenerating?: boolean  // Show generating card in grid
  generatingCount?: number  // Number of images being generated (shows multiple generating cards)
  isLoadingSkeleton?: boolean  // Show skeleton grid while loading history
  className?: string
  onImageClick?: (imageUrl: string, index: number) => void
  onUseAsReference?: (imageUrl: string, index: number) => void
  onCreateAsset?: (imageUrl: string, index: number) => void
  onUpscale?: (imageUrl: string, index: number) => void
  upscalingImageUrl?: string | null
  onDelete?: (id: string, imageUrl: string, index: number) => void
}

// Normalize model names by removing prefix before slash, replacing dashes with spaces, and capitalizing
function normalizeModelName(name: string): string {
  // Remove everything before and including the first slash
  const nameAfterSlash = name.includes('/') ? name.split('/').slice(1).join('/') : name
  
  return nameAfterSlash
    .replace(/\-/g, ' ')       // Replace dashes with spaces
    .toLowerCase()             // Convert to lowercase
    .split(' ')                // Split into words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))  // Capitalize each word
    .join(' ')                 // Join back together
}

export function ImageGrid({
  images,
  isGenerating = false,
  generatingCount = 1,
  isLoadingSkeleton = false,
  className,
  onImageClick,
  onUseAsReference,
  onCreateAsset,
  onUpscale,
  upscalingImageUrl = null,
  onDelete,
}: ImageGridProps) {
  const router = useRouter()
  const [columnCount, setColumnCount] = React.useState(2) // Default 2 columns
  const [fullscreenImage, setFullscreenImage] = React.useState<ImageData | null>(null)
  const [copiedImageUrl, setCopiedImageUrl] = React.useState<string | null>(null)
  const [copiedPromptKey, setCopiedPromptKey] = React.useState<string | null>(null)
  const [deletingImageId, setDeletingImageId] = React.useState<string | null>(null)

  const normalizedImages = React.useMemo(
    () =>
      images.map((item) =>
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
    [images]
  )

  const handleDownload = React.useCallback(async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error("Failed to fetch image for download")
      }

      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const extension = blob.type.split("/")[1] || "png"
      const anchor = document.createElement("a")
      anchor.href = blobUrl
      anchor.download = `generated-image-${Date.now()}.${extension}`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      window.URL.revokeObjectURL(blobUrl)
    } catch {
      const anchor = document.createElement("a")
      anchor.href = imageUrl
      anchor.download = `generated-image-${Date.now()}.png`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
    }
  }, [])

  const handleCopy = React.useCallback(async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error("Failed to fetch image for clipboard copy")
      }

      const blob = await response.blob()
      const canWriteImage =
        typeof navigator !== "undefined" &&
        !!navigator.clipboard &&
        typeof ClipboardItem !== "undefined" &&
        blob.type.startsWith("image/")

      if (canWriteImage) {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
        toast.success("Image copied to clipboard")
      } else {
        await navigator.clipboard.writeText(imageUrl)
        toast.success("Image URL copied to clipboard")
      }

      setCopiedImageUrl(imageUrl)
      window.setTimeout(() => setCopiedImageUrl(null), 1500)
    } catch {
      if (navigator?.clipboard) {
        try {
          await navigator.clipboard.writeText(imageUrl)
          toast.success("Image URL copied to clipboard")
          setCopiedImageUrl(imageUrl)
          window.setTimeout(() => setCopiedImageUrl(null), 1500)
        } catch {
          toast.error("Failed to copy image")
        }
      } else {
        toast.error("Clipboard not available")
      }
    }
  }, [])

  const handleCopyPrompt = React.useCallback(async (prompt: string, key: string) => {
    if (!prompt.trim()) {
      return
    }

    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPromptKey(key)
      window.setTimeout(() => setCopiedPromptKey(null), 1500)
    } catch {
      // Ignore clipboard errors to keep the UI non-blocking.
    }
  }, [])

  const handleDelete = React.useCallback(async (id: string, imageUrl: string, index: number) => {
    if (!id) {
      console.error('Cannot delete image without ID')
      return
    }

    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return
    }

    setDeletingImageId(id)
    
    try {
      onDelete?.(id, imageUrl, index)
    } finally {
      setDeletingImageId(null)
    }
  }, [onDelete])

  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFullscreenImage(null)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [])

  // Grid column class mapping
  const isOneColumn = columnCount === 1
  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  }[columnCount] || 'grid-cols-2'

  // Gap class mapping - use larger gap for single column, no gap for multi-column
  const gapClass = isOneColumn ? 'gap-4' : 'gap-0'

  return (
    <div className={cn("w-full h-full flex flex-col py-0", className)}>
      {/* Shared keyframe for generating and upscaling animations */}
      <style dangerouslySetInnerHTML={{ __html: `@keyframes fillProgress { 0% { width: 0%; } 100% { width: 100%; } }` }} />
      {/* Column Count Slider - Integrated header, matches card styling */}
      <div className="  p-3 sm:p-4 pb-3 sm:pb-4 ">
        <div className="flex items-center justify-end gap-3 sm:gap-4 w-full">
          <label className="text-xs sm:text-sm font-medium whitespace-nowrap text-foreground">
            Columns: <span className="text-primary">{columnCount}</span>
          </label>
          <Slider
            value={[columnCount]}
            onValueChange={(value) => setColumnCount(value[0])}
            min={1}
            max={6}
            step={1}
            className="w-24 sm:w-32"
          />
        </div>
      </div>

      {/* Image Grid - Masonry style with fixed row heights */}
      <div className="flex-1 min-h-0 p-0 pt-0">
        <div 
          className={cn(
            "grid p-2 overflow-auto h-full",
            gridColsClass,
            gapClass,
            // Center items in one-column mode
            isOneColumn && "justify-items-center",
            // Hide scrollbar while maintaining scrollability
            "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          )}
          style={{
            gridAutoRows: 'auto', // Let aspect-square determine row height
            gridAutoFlow: 'row', // Ensure proper row wrapping
          }}
        >
          {/* Skeleton loading grid - shown when loading history */}
          {isLoadingSkeleton && Array.from({ length: 12 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className={cn(
                "w-full bg-muted/30 animate-pulse",
                isOneColumn ? "aspect-auto min-h-[50vh]" : "aspect-square"
              )}
            />
          ))}

          {/* Generating cards - show one card for each image being generated */}
          {isGenerating && !isLoadingSkeleton && Array.from({ length: generatingCount }).map((_, index) => (
            <div 
              key={`generating-${index}`} 
              className={cn(
                "relative w-full overflow-hidden bg-zinc-900 rounded-lg",
                isOneColumn ? "aspect-auto min-h-[50vh]" : "aspect-square"
              )}
            >
              {/* White fading line animation - 20 second infinite duration */}
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-zinc-800 to-zinc-700"
                style={{
                  width: '0%',
                  animation: 'fillProgress 20s linear infinite',
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
          ))}
          
          {/* Render existing images - square cards with natural aspect ratio images */}
          {!isLoadingSkeleton && normalizedImages.map((image, index) => (
            <div
              key={`image-${index}-${image.url}`}
              className={cn(
                "group relative bg-background flex items-center justify-center w-full cursor-pointer",
                isOneColumn ? "aspect-auto" : "aspect-square"
              )}
              onClick={() => setFullscreenImage(image)}
              draggable
              onDragStart={(e) => {
                // Set data in the format AI chat expects (same as canvas image-gen nodes)
                const nodeData = {
                  id: `image-grid-${index}`,
                  type: 'image-gen',
                  data: { generatedImageUrl: image.url }
                }
                e.dataTransfer.setData('application/reactflow-node', JSON.stringify(nodeData))
                e.dataTransfer.effectAllowed = 'copy'
                // Use the image as drag preview
                if (e.currentTarget.querySelector('img')) {
                  const img = e.currentTarget.querySelector('img')
                  if (img) {
                    e.dataTransfer.setDragImage(img, 0, 0)
                  }
                }
              }}
            >
              <img
                src={image.url}
                alt={`Generated image ${index + 1}`}
                className={cn(
                  "w-auto h-auto object-contain pointer-events-none",
                  isOneColumn ? "max-h-[50vh] max-w-full" : "max-w-full max-h-full"
                )}
                loading="lazy"
                draggable={false}
              />

              {/* Upscaling overlay - generating animation over the image */}
              {upscalingImageUrl === image.url && (
                <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg overflow-hidden bg-black/50 pointer-events-auto">
                  {/* White line sweep (same as generating cards) */}
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-zinc-700 to-zinc-500"
                    style={{
                      width: '0%',
                      animation: 'fillProgress 20s linear infinite',
                      boxShadow: '2px 0 8px 0 rgba(255, 255, 255, 0.4)',
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/40 via-transparent to-zinc-900/40 pointer-events-none" />
                  <span className="relative z-10 text-xs font-medium text-white drop-shadow-md">Upscaling…</span>
                </div>
              )}

              {/* Bottom gradient overlay for prompt readability - no solid background */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 via-black/35 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

              <div className="absolute right-2 top-2 z-10 flex flex-col items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {/* Main action buttons - always visible on hover */}
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7 rounded-full border border-white/20 bg-black/55 text-white hover:bg-black/75"
                  onClick={(event) => {
                    event.stopPropagation()
                    setFullscreenImage(image)
                  }}
                  aria-label="View full screen"
                >
                  <ArrowsOutSimple className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7 rounded-full border border-white/20 bg-black/55 text-white hover:bg-black/75"
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleDownload(image.url)
                  }}
                  aria-label="Download image"
                >
                  <DownloadSimple className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7 rounded-full border border-white/20 bg-black/55 text-white hover:bg-black/75"
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleCopy(image.url)
                  }}
                  aria-label="Copy image"
                >
                  {copiedImageUrl === image.url ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
                
                {/* Dropdown menu with all options including Create Asset */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7 rounded-full border border-white/20 bg-black/55 text-white hover:bg-black/75"
                      onClick={(event) => {
                        event.stopPropagation()
                      }}
                      aria-label="More options"
                    >
                      <DotsThree className="size-4" weight="bold" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-48"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation()
                        onCreateAsset?.(image.url, index)
                      }}
                      className="cursor-pointer"
                    >
                      <Plus className="mr-2 size-4" />
                      Create Asset
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation()
                        setFullscreenImage(image)
                      }}
                      className="cursor-pointer"
                    >
                      <ArrowsOutSimple className="mr-2 size-4" />
                      Full Screen
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleDownload(image.url)
                      }}
                      className="cursor-pointer"
                    >
                      <DownloadSimple className="mr-2 size-4" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleCopy(image.url)
                      }}
                      className="cursor-pointer"
                    >
                      {copiedImageUrl === image.url ? (
                        <>
                          <Check className="mr-2 size-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 size-4" />
                          Copy
                        </>
                      )}
                    </DropdownMenuItem>
                    {image.id && onDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleDelete(image.id!, image.url, index)
                          }}
                          className="cursor-pointer text-destructive focus:text-destructive"
                          disabled={deletingImageId === image.id}
                        >
                          <Trash className="mr-2 size-4" />
                          {deletingImageId === image.id ? 'Deleting...' : 'Delete'}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Bottom bar: prompt (left) + buttons (right) - no overlap */}
              <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-1 sm:gap-2 px-2 pb-2 pt-6 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <div className="min-w-0 flex-1 overflow-hidden pr-1 sm:pr-2">
                  {image.model && (
                    <p className="truncate text-[10px] font-semibold tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      {normalizeModelName(image.model)}
                    </p>
                  )}
                  {image.prompt && (
                    <button
                      type="button"
                      className="line-clamp-2 w-full text-left text-[10px] leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] hover:text-white/95"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleCopyPrompt(image.prompt ?? "", `${image.url}-text`)
                      }}
                      title="Click to copy prompt"
                    >
                      {image.prompt}
                    </button>
                  )}
                </div>
                
                {/* Desktop buttons (sm and up) - column */}
                <div className="hidden sm:flex shrink-0 flex-col items-end gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!image.prompt?.trim()}
                    className="h-7 rounded-full border border-white/20 bg-black/55 px-2.5 text-[11px] font-medium text-white hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleCopyPrompt(image.prompt ?? "", `${image.url}-button`)
                    }}
                  >
                    {copiedPromptKey && copiedPromptKey.startsWith(image.url) ? "Copied" : "Copy Prompt"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 rounded-full border border-white/20 bg-black/55 px-2.5 text-[11px] font-medium text-white hover:bg-black/75"
                    onClick={(event) => {
                      event.stopPropagation()
                      onUseAsReference?.(image.url, index)
                    }}
                  >
                    Reference
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 rounded-full border border-white/20 bg-black/55 px-2.5 text-[11px] font-medium text-white hover:bg-black/75"
                    onClick={(event) => {
                      event.stopPropagation()
                      const encodedUrl = encodeURIComponent(image.url)
                      router.push(`/video?startFrame=${encodedUrl}`)
                    }}
                  >
                    <Play className="mr-1 size-3" weight="fill" />
                    Animate
                  </Button>
                  {onUpscale && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={upscalingImageUrl === image.url}
                      className="h-7 rounded-full border border-white/20 bg-black/55 px-2.5 text-[11px] font-medium text-white hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={(event) => {
                        event.stopPropagation()
                        onUpscale(image.url, index)
                      }}
                    >
                      {upscalingImageUrl === image.url ? (
                        "Upscaling…"
                      ) : (
                        <>
                          <MagnifyingGlassPlus className="mr-1 size-3" />
                          Upscale
                        </>
                      )}
                    </Button>
                  )}
                </div>
                
                {/* Mobile - column of actions (below sm) */}
                <div className="flex sm:hidden shrink-0 flex-col items-end gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 rounded-full border border-white/20 bg-black/55 px-2.5 text-[11px] font-medium text-white hover:bg-black/75"
                        onClick={(event) => {
                          event.stopPropagation()
                        }}
                      >
                        <Play className="mr-1 size-3" weight="fill" />
                        Animate
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="end" 
                      className="w-48"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <DropdownMenuItem
                        onClick={(event) => {
                          event.stopPropagation()
                          const encodedUrl = encodeURIComponent(image.url)
                          router.push(`/video?startFrame=${encodedUrl}`)
                        }}
                        className="cursor-pointer"
                      >
                        <Play className="mr-2 size-4" weight="fill" />
                        Animate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(event) => {
                          event.stopPropagation()
                          onUseAsReference?.(image.url, index)
                        }}
                        className="cursor-pointer"
                      >
                        <ArrowsOutSimple className="mr-2 size-4" />
                        Use as Reference
                      </DropdownMenuItem>
                      {onUpscale && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(event) => {
                              event.stopPropagation()
                              onUpscale(image.url, index)
                            }}
                            className="cursor-pointer"
                            disabled={upscalingImageUrl === image.url}
                          >
                            <MagnifyingGlassPlus className="mr-2 size-4" />
                            {upscalingImageUrl === image.url ? "Upscaling…" : "Upscale"}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
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
          onDownload={handleDownload}
          onCopy={handleCopy}
          onDelete={onDelete ? (id, url) => {
            const imageIndex = normalizedImages.findIndex(img => img.id === id)
            if (imageIndex !== -1) {
              handleDelete(id, url, imageIndex)
              setFullscreenImage(null)
            }
          } : undefined}
          onSaveToAssets={onCreateAsset ? (url) => {
            const imageIndex = normalizedImages.findIndex(img => img.url === url)
            if (imageIndex !== -1) {
              onCreateAsset(url, imageIndex)
            }
          } : undefined}
          copiedImageUrl={copiedImageUrl}
          deletingImageId={deletingImageId}
        />
      )}
    </div>
  )
}
