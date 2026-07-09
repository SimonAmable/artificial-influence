"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { ArrowsOutSimple, Copy, DownloadSimple, Check, DotsThree, Plus, Trash, Play, MagnifyingGlassPlus, ArrowsClockwise, PencilSimple, ShieldCheck, Eraser, Sparkle, ImageSquare, PaperPlaneTilt, Vault } from "@phosphor-icons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { ImageGridAgentAction } from "@/lib/chat/image-grid-agent-actions"
import { FullscreenMediaViewer, type FullscreenMediaViewerAction } from "./fullscreen-media-viewer"
import { copyMediaToClipboard, downloadMediaFile } from "./media-viewer-utils"
import { toast } from "sonner"

export type { ImageGridAgentAction }

interface ImageData {
  id?: string
  url: string
  model?: string | null
  prompt?: string | null
  tool?: string | null
  aspectRatio?: string | null
  type?: string | null
  createdAt?: string | null
  referenceImageUrls?: string[]
}

export type GridItem =
  | { type: "image"; data: ImageData }
  | { type: "generating"; id: string }

interface ImageGridProps {
  /** Unified list of items (images + generating slots). When provided, takes precedence over images/isGenerating/generatingCount. */
  items?: GridItem[]
  images?: Array<string | ImageData>
  isGenerating?: boolean  // Show generating card in grid (legacy, when items not provided)
  generatingCount?: number  // Number of images being generated (legacy)
  isLoadingSkeleton?: boolean  // Show skeleton grid while loading history
  className?: string
  onImageClick?: (imageUrl: string, index: number) => void
  onUseAsReference?: (imageUrl: string, index: number) => void
  /** When set, Edit opens this handler instead of navigating to /inpaint */
  onEdit?: (imageUrl: string, index: number) => void
  onRecreate?: (image: ImageData) => void
  onCreateAsset?: (imageUrl: string, index: number) => void
  onSaveExample?: (imageUrl: string, index: number) => void
  onUpscale?: (imageUrl: string, index: number) => void
  onRemoveMetadata?: (imageUrl: string, index: number) => void
  onRemoveBackground?: (imageUrl: string, index: number) => void
  upscalingImageUrl?: string | null
  removingMetadataImageUrl?: string | null
  removingBackgroundImageUrl?: string | null
  onDelete?: (id: string, imageUrl: string, index: number) => void | Promise<void>
  basicActionsOnly?: boolean
  /** `direct` = /image-style navigation; `agent` = composer injection via onAgentAction */
  actionStrategy?: "direct" | "agent"
  onAgentAction?: (action: ImageGridAgentAction, image: ImageData, index: number) => void
  /** Controlled column count when the slider is rendered outside the grid. */
  columnCount?: number
  onColumnCountChange?: (value: number) => void
  /** Initial column count for the layout slider (default 2). */
  initialColumnCount?: number
  /** Hide column count slider (e.g. embedded chat tool cards). */
  showColumnSlider?: boolean
  fanvueActions?: {
    onSendToVault: (imageUrl: string, index: number) => void
    onCreatePost: (imageUrl: string, index: number) => void
  }
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

function getImageItemKey(image: ImageData): string {
  if (image.id) return `image-${image.id}`
  if (image.createdAt) return `image-${image.createdAt}-${image.url}`
  return `image-${image.url}`
}

export function ImageGrid({
  items: itemsProp,
  images = [],
  isGenerating = false,
  generatingCount = 1,
  isLoadingSkeleton = false,
  className,
  onImageClick,
  onUseAsReference,
  onEdit,
  onRecreate,
  onCreateAsset,
  onSaveExample,
  onUpscale,
  onRemoveMetadata,
  onRemoveBackground,
  upscalingImageUrl = null,
  removingMetadataImageUrl = null,
  removingBackgroundImageUrl = null,
  onDelete,
  basicActionsOnly = false,
  actionStrategy = "direct",
  onAgentAction,
  columnCount,
  onColumnCountChange,
  initialColumnCount = 2,
  showColumnSlider = true,
  fanvueActions,
}: ImageGridProps) {
  const router = useRouter()
  const isAgentMode = actionStrategy === "agent"
  const showExtendedActions = !basicActionsOnly || isAgentMode
  const isColumnCountControlled = typeof columnCount === "number"
  const [uncontrolledColumnCount, setUncontrolledColumnCount] = React.useState(initialColumnCount)
  const activeColumnCount = isColumnCountControlled ? columnCount : uncontrolledColumnCount
  const isCondensed = activeColumnCount >= 3 || basicActionsOnly

  React.useEffect(() => {
    if (isColumnCountControlled) {
      return
    }

    const saved = window.localStorage.getItem("unican-image-column-count")
    if (saved) {
      const parsed = parseInt(saved, 10)
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 6) {
        setUncontrolledColumnCount(parsed)
      }
    }
  }, [isColumnCountControlled])

  const handleColumnCountChange = React.useCallback((value: number) => {
    if (isColumnCountControlled) {
      onColumnCountChange?.(value)
      return
    }

    setUncontrolledColumnCount(value)
    window.localStorage.setItem("unican-image-column-count", String(value))
    onColumnCountChange?.(value)
  }, [isColumnCountControlled, onColumnCountChange])

  const [fullscreenImage, setFullscreenImage] = React.useState<ImageData | null>(null)
  const [copiedImageUrl, setCopiedImageUrl] = React.useState<string | null>(null)
  const [copiedPromptKey, setCopiedPromptKey] = React.useState<string | null>(null)
  const [deletingImageId, setDeletingImageId] = React.useState<string | null>(null)
  const [pendingDeleteImage, setPendingDeleteImage] = React.useState<{
    id: string
    url: string
    index: number
  } | null>(null)
  const [failedUrls, setFailedUrls] = React.useState<Record<string, boolean>>({})

  const renderDropdownContent = (data: ImageData, index: number) => {
    return (
      <DropdownMenuContent
        align="end"
        className="w-56"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Creative / reference options first */}
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation()
            runReferenceAction(data, index)
          }}
          className="cursor-pointer"
        >
          <ImageSquare className="mr-2 size-4" />
          Use as Reference
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation()
            runEditAction(data, index)
          }}
          className="cursor-pointer"
        >
          <PencilSimple className="mr-2 size-4" />
          Edit Image
        </DropdownMenuItem>
        {(isAgentMode || onRecreate) && (
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation()
              runRecreateAction(data, index)
            }}
            className="cursor-pointer"
          >
            <ArrowsClockwise className="mr-2 size-4" />
            Recreate
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation()
            runAnimateAction(data, index)
          }}
          className="cursor-pointer"
        >
          <Play className="mr-2 size-4" weight="fill" />
          Animate
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Assets & Workflow actions */}
        {showExtendedActions && onCreateAsset && (
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation()
              onCreateAsset(data.url, index)
            }}
            className="cursor-pointer"
          >
            <Plus className="mr-2 size-4" />
            {isAgentMode ? "Save to Assets" : "Create Asset"}
          </DropdownMenuItem>
        )}
        {onSaveExample && (
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation()
              onSaveExample(data.url, index)
            }}
            className="cursor-pointer"
          >
            <Sparkle className="mr-2 size-4" weight="regular" />
            Save Example
          </DropdownMenuItem>
        )}

        {fanvueActions ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation()
                fanvueActions.onSendToVault(data.url, index)
              }}
              className="cursor-pointer"
            >
              <Vault className="mr-2 size-4" />
              Send to Fanvue Vault
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation()
                fanvueActions.onCreatePost(data.url, index)
              }}
              className="cursor-pointer"
            >
              <PaperPlaneTilt className="mr-2 size-4" />
              Create Fanvue Post
            </DropdownMenuItem>
          </>
        ) : null}

        <DropdownMenuSeparator />

        {/* Basic utilities */}
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation()
            setFullscreenImage(data)
          }}
          className="cursor-pointer"
        >
          <ArrowsOutSimple className="mr-2 size-4" />
          Full Screen
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation()
            void handleDownload(data.url)
          }}
          className="cursor-pointer"
        >
          <DownloadSimple className="mr-2 size-4" />
          Download
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation()
            void handleCopy(data.url)
          }}
          className="cursor-pointer"
        >
          {copiedImageUrl === data.url ? (
            <>
              <Check className="mr-2 size-4" />
              Copied Image
            </>
          ) : (
            <>
              <Copy className="mr-2 size-4" />
              Copy Image
            </>
          )}
        </DropdownMenuItem>
        {data.prompt && (
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation()
              void handleCopyPrompt(data.prompt ?? "", `${data.url}-dropdown-prompt`)
            }}
            className="cursor-pointer"
          >
            <Copy className="mr-2 size-4" />
            {copiedPromptKey === `${data.url}-dropdown-prompt` ? "Prompt Copied" : "Copy Prompt"}
          </DropdownMenuItem>
        )}

        {/* AI editing utilities */}
        {(onUpscale || onRemoveBackground || onRemoveMetadata) && (
          <>
            <DropdownMenuSeparator />
            {onUpscale && (
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation()
                  onUpscale(data.url, index)
                }}
                className="cursor-pointer"
                disabled={upscalingImageUrl === data.url}
              >
                <MagnifyingGlassPlus className="mr-2 size-4" />
                {upscalingImageUrl === data.url ? "Upscaling..." : "Upscale Image"}
              </DropdownMenuItem>
            )}
            {onRemoveBackground && (
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation()
                  runRemoveBackgroundAction(data, index)
                }}
                className="cursor-pointer"
                disabled={removingBackgroundImageUrl === data.url}
              >
                <Eraser className="mr-2 size-4" />
                {removingBackgroundImageUrl === data.url ? "Removing BG..." : "Remove Background"}
              </DropdownMenuItem>
            )}
            {onRemoveMetadata && (
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation()
                  onRemoveMetadata(data.url, index)
                }}
                className="cursor-pointer"
                disabled={removingMetadataImageUrl === data.url}
              >
                <ShieldCheck className="mr-2 size-4" />
                {removingMetadataImageUrl === data.url ? "Cleaning..." : "Remove Metadata"}
              </DropdownMenuItem>
            )}
          </>
        )}

        {/* Destructive delete option */}
        {showExtendedActions && data.id && onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation()
                requestDelete(data.id!, data.url, index)
              }}
              className="cursor-pointer text-destructive focus:text-destructive"
              disabled={deletingImageId === data.id}
            >
              <Trash className="mr-2 size-4" />
              {deletingImageId === data.id ? 'Deleting...' : 'Delete'}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    )
  }

  // Build unified items: either from items prop (slot-based) or from images + isGenerating + generatingCount (legacy)
  const items = React.useMemo((): GridItem[] => {
    if (itemsProp && itemsProp.length > 0) {
      return itemsProp
    }
    const normalized = images.map((item) =>
      typeof item === "string"
        ? { id: undefined, url: item, model: null, prompt: null, tool: null, aspectRatio: null, type: null, createdAt: null, referenceImageUrls: [] }
        : {
            id: item.id,
            url: item.url,
            model: item.model ?? null,
            prompt: item.prompt ?? null,
            tool: item.tool ?? null,
            aspectRatio: item.aspectRatio ?? null,
            type: item.type ?? null,
            createdAt: item.createdAt ?? null,
            referenceImageUrls: (item as ImageData).referenceImageUrls ?? (item as { reference_image_urls?: string[] }).reference_image_urls ?? [],
          }
    )
    const imageItems: GridItem[] = normalized.map((data) => ({ type: "image", data }))
    if (isGenerating && generatingCount > 0) {
      const generatingItems: GridItem[] = Array.from({ length: generatingCount }, (_, i) => ({
        type: "generating",
        id: `legacy-gen-${i}`,
      }))
      return [...generatingItems, ...imageItems]
    }
    return imageItems
  }, [itemsProp, images, isGenerating, generatingCount])

  const normalizedImages = React.useMemo(
    () => items.filter((i): i is { type: "image"; data: ImageData } => i.type === "image").map((i) => i.data),
    [items]
  )

  const handleDownload = React.useCallback(async (imageUrl: string) => {
    await downloadMediaFile({ url: imageUrl, kind: "image" })
  }, [])

  const handleCopy = React.useCallback(async (imageUrl: string) => {
    try {
      const result = await copyMediaToClipboard({ url: imageUrl, kind: "image" })
      if (result === "media") {
        toast.success("Image copied to clipboard")
      } else {
        toast.success("Image URL copied to clipboard")
      }
      setCopiedImageUrl(imageUrl)
      window.setTimeout(() => setCopiedImageUrl(null), 1500)
    } catch {
      toast.error("Failed to copy image")
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

  const requestDelete = React.useCallback((id: string, imageUrl: string, index: number) => {
    if (!id) {
      console.error('Cannot delete image without ID')
      return
    }

    setPendingDeleteImage({ id, url: imageUrl, index })
  }, [])

  const confirmDelete = React.useCallback(async () => {
    if (!pendingDeleteImage) return
    const { id, url, index } = pendingDeleteImage
    setDeletingImageId(id)

    try {
      await onDelete?.(id, url, index)
      setPendingDeleteImage(null)
      setFullscreenImage((current) => (current?.id === id ? null : current))
    } finally {
      setDeletingImageId(null)
    }
  }, [onDelete, pendingDeleteImage])

  const runReferenceAction = React.useCallback(
    (data: ImageData, index: number) => {
      if (isAgentMode && onAgentAction) {
        onAgentAction("reference", data, index)
        return
      }
      onUseAsReference?.(data.url, index)
    },
    [isAgentMode, onAgentAction, onUseAsReference],
  )

  const runEditAction = React.useCallback(
    (data: ImageData, index: number) => {
      if (isAgentMode && onAgentAction) {
        onAgentAction("edit", data, index)
        return
      }
      if (onEdit) {
        onEdit(data.url, index)
        return
      }
      router.push(`/inpaint?image=${encodeURIComponent(data.url)}`)
    },
    [isAgentMode, onAgentAction, onEdit, router],
  )

  const runRecreateAction = React.useCallback(
    (data: ImageData, index: number) => {
      if (isAgentMode && onAgentAction) {
        onAgentAction("recreate", data, index)
        return
      }
      onRecreate?.(data)
    },
    [isAgentMode, onAgentAction, onRecreate],
  )

  const runAnimateAction = React.useCallback(
    (data: ImageData, index: number) => {
      if (isAgentMode && onAgentAction) {
        onAgentAction("animate", data, index)
        return
      }
      router.push(`/video?startFrame=${encodeURIComponent(data.url)}`)
    },
    [isAgentMode, onAgentAction, router],
  )

  const runRemoveBackgroundAction = React.useCallback(
    (data: ImageData, index: number) => {
      onRemoveBackground?.(data.url, index)
    },
    [onRemoveBackground],
  )

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
  const isOneColumn = activeColumnCount === 1
  const gridColsClass = {
    1: 'grid-cols-1 max-w-2xl mx-auto',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  }[activeColumnCount] || 'grid-cols-2'

  // Keep a small gap in multi-column mode so identical generating cards stay visually distinct.
  const gapClass = isOneColumn ? 'gap-4' : 'gap-1'

  return (
    <div className={cn("w-full h-full flex flex-col py-0", className)}>
      {/* Shared keyframe for generating and upscaling animations */}
      <style dangerouslySetInnerHTML={{ __html: `@keyframes fillProgress { 0% { width: 0%; } 100% { width: 100%; } }` }} />
      {/* Column Count Slider - Integrated header, matches card styling */}
      {showColumnSlider ? (
        <div className="p-3 pb-3 sm:p-4 sm:pb-4">
          <div className="flex w-full items-center justify-end gap-3 sm:gap-4">
            <label className="whitespace-nowrap text-xs font-medium text-foreground sm:text-sm">
              Columns: <span className="text-primary">{activeColumnCount}</span>
            </label>
            <Slider
              value={[activeColumnCount]}
              onValueChange={(value) => handleColumnCountChange(value[0])}
              min={1}
              max={6}
              step={1}
              className="w-24 sm:w-32"
            />
          </div>
        </div>
      ) : null}

      {/* Image Grid - Masonry style with fixed row heights */}
      <div className="flex-1 min-h-0 overflow-auto p-0 pt-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div
          className={cn(
            "grid w-full auto-rows-auto content-start items-start justify-items-stretch p-2",
            gridColsClass,
            gapClass,
            // Center items in one-column mode
            isOneColumn && "justify-items-center",
          )}
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

          {/* Unified items: generating slots and image cards in order */}
          {!isLoadingSkeleton &&
            items.map((item, index) =>
              item.type === "generating" ? (
                <div
                  key={item.id}
                  className={cn(
                    "relative isolate w-full min-w-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900",
                    isOneColumn ? "min-h-[50vh]" : "aspect-square min-h-0"
                  )}
                >
                  {/* White fading line animation - 20 second infinite duration */}
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-zinc-800 to-zinc-700"
                    style={{
                      width: "0%",
                      animation: "fillProgress 20s linear infinite",
                      boxShadow: "2px 0 8px 0 rgba(255, 255, 255, 0.4)",
                    }}
                  />
                  {/* Overlay gradient for depth */}
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/30 via-transparent to-zinc-900/30 pointer-events-none" />
                  <div className="absolute bottom-2 left-2 z-10 rounded-md bg-black/50 px-2 py-1 text-[10px] font-medium text-white/90">
                    Generating...
                  </div>
                </div>
              ) : (
            <div
              key={getImageItemKey(item.data)}
              className={cn(
                "group relative flex w-full min-w-0 cursor-pointer items-center justify-center bg-background",
                isOneColumn ? "aspect-auto" : "aspect-square min-h-0"
              )}
              onClick={() => {
                if (failedUrls[item.data.url]) return
                setFullscreenImage(item.data)
              }}
              draggable={!failedUrls[item.data.url]}
              onDragStart={(e) => {
                if (failedUrls[item.data.url]) {
                  e.preventDefault()
                  return
                }
                // Set data in the format AI chat expects (same as canvas image-gen nodes)
                const nodeData = {
                  id: `image-grid-${index}`,
                  type: 'image-gen',
                  data: { generatedImageUrl: item.data.url }
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
              {failedUrls[item.data.url] ? (
                <div className={cn(
                  "flex flex-col items-center justify-center bg-zinc-900 border border-white/10 text-muted-foreground p-6 pb-16 text-center gap-2 rounded-lg",
                  isOneColumn ? "w-full aspect-square sm:aspect-video max-h-[50vh]" : "w-full h-full aspect-square"
                )}>
                  <div className="rounded-full bg-zinc-800 p-3 text-zinc-400">
                    <ImageSquare className="size-6" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-200">Image unavailable</span>
                  <span className="text-[10px] text-zinc-400 max-w-[200px]">This image failed to load or has expired.</span>
                </div>
              ) : (
                <img
                  src={item.data.url}
                  alt={`Generated image ${index + 1}`}
                  className={cn(
                    "w-auto h-auto object-contain pointer-events-none",
                    isOneColumn ? "max-h-[50vh] max-w-full" : "max-w-full max-h-full"
                  )}
                  loading="lazy"
                  draggable={false}
                  onError={() => {
                    setFailedUrls((prev) => ({ ...prev, [item.data.url]: true }))
                  }}
                />
              )}

              {/* Upscaling overlay - generating animation over the image */}
              {upscalingImageUrl === item.data.url && (
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
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />              <div
                className={cn(
                  "absolute right-2 top-2 z-10 flex items-center gap-1 opacity-100 transition-opacity duration-200 lg:opacity-0 lg:group-hover:opacity-100",
                  isCondensed ? "flex-row" : "flex-col"
                )}
              >
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7 rounded-full border border-white/20 bg-black/55 text-white hover:bg-black/75"
                  onClick={(event) => {
                    event.stopPropagation()
                    setFullscreenImage(item.data)
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
                    void handleDownload(item.data.url)
                  }}
                  aria-label="Download image"
                >
                  <DownloadSimple className="size-3.5" />
                </Button>

                {!isCondensed && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 rounded-full border border-white/20 bg-black/55 text-white hover:bg-black/75"
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleCopy(item.data.url)
                    }}
                    aria-label="Copy image"
                  >
                    {copiedImageUrl === item.data.url ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                )}

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
                  {renderDropdownContent(item.data, index)}
                </DropdownMenu>
              </div>

              {/* Bottom bar: prompt (left) + buttons (right) - no overlap */}
              <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-1 px-2 pb-2 pt-6 opacity-100 transition-opacity duration-200 lg:gap-2 lg:opacity-0 lg:group-hover:opacity-100">
                <div className="min-w-0 flex-1 overflow-hidden pr-1 sm:pr-2">
                  {item.data.model && (
                    <p className="truncate text-[10px] font-semibold tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      {normalizeModelName(item.data.model)}
                    </p>
                  )}
                  {item.data.prompt && (
                    <button
                      type="button"
                      className="line-clamp-2 w-full text-left text-[10px] leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] hover:text-white/95"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleCopyPrompt(item.data.prompt ?? "", `${item.data.url}-text`)
                      }}
                      title="Click to copy prompt"
                    >
                      {item.data.prompt}
                    </button>
                  )}
                </div>
                {showExtendedActions && !isCondensed ? (
                  <div className="hidden shrink-0 flex-col items-end gap-1 lg:flex">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={!item.data.prompt?.trim()}
                      className="h-7 rounded-full border border-white/20 bg-black/55 px-2.5 text-[11px] font-medium text-white hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleCopyPrompt(item.data.prompt ?? "", `${item.data.url}-button`)
                      }}
                    >
                      {copiedPromptKey && copiedPromptKey.startsWith(item.data.url) ? "Copied" : "Copy Prompt"}
                    </Button>
                    {onSaveExample ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 rounded-full border border-white/20 bg-black/55 px-2.5 text-[11px] font-medium text-white hover:bg-black/75"
                        onClick={(event) => {
                          event.stopPropagation()
                          onSaveExample(item.data.url, index)
                        }}
                      >
                        <Sparkle className="mr-1 size-3" weight="regular" />
                        Save Example
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 rounded-full border border-white/20 bg-black/55 px-2.5 text-[11px] font-medium text-white hover:bg-black/75"
                      onClick={(event) => {
                        event.stopPropagation()
                        runReferenceAction(item.data, index)
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
                        runEditAction(item.data, index)
                      }}
                    >
                      <PencilSimple className="mr-1 size-3" />
                      Edit
                    </Button>
                    {(isAgentMode || onRecreate) && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 rounded-full border border-white/20 bg-black/55 px-2.5 text-[11px] font-medium text-white hover:bg-black/75"
                        onClick={(event) => {
                          event.stopPropagation()
                          runRecreateAction(item.data, index)
                        }}
                      >
                        <ArrowsClockwise className="mr-1 size-3" />
                        Recreate
                      </Button>
                    )}
                    {onCreateAsset && isAgentMode ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 rounded-full border border-white/20 bg-black/55 px-2.5 text-[11px] font-medium text-white hover:bg-black/75"
                        onClick={(event) => {
                          event.stopPropagation()
                          onCreateAsset(item.data.url, index)
                        }}
                      >
                        <Plus className="mr-1 size-3" />
                        Save to Assets
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 rounded-full border border-white/20 bg-black/55 px-2.5 text-[11px] font-medium text-white hover:bg-black/75"
                      onClick={(event) => {
                        event.stopPropagation()
                        runAnimateAction(item.data, index)
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
                        disabled={upscalingImageUrl === item.data.url}
                        className="h-7 rounded-full border border-white/20 bg-black/55 px-2.5 text-[11px] font-medium text-white hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={(event) => {
                          event.stopPropagation()
                          onUpscale(item.data.url, index)
                        }}
                      >
                        {upscalingImageUrl === item.data.url ? (
                          "Upscaling…"
                        ) : (
                          <>
                            <MagnifyingGlassPlus className="mr-1 size-3" />
                            Upscale
                          </>
                        )}
                      </Button>
                    )}
                    {onRemoveBackground && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={removingBackgroundImageUrl === item.data.url}
                        className="h-7 rounded-full border border-white/20 bg-black/55 px-2.5 text-[11px] font-medium text-white hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={(event) => {
                          event.stopPropagation()
                          runRemoveBackgroundAction(item.data, index)
                        }}
                      >
                        {removingBackgroundImageUrl === item.data.url ? (
                          "Removing..."
                        ) : (
                          <>
                            <Eraser className="mr-1 size-3" />
                            Remove BG
                          </>
                        )}
                      </Button>
                    )}
                    {onRemoveMetadata && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={removingMetadataImageUrl === item.data.url}
                        className="h-7 rounded-full border border-white/20 bg-black/55 px-2.5 text-[11px] font-medium text-white hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={(event) => {
                          event.stopPropagation()
                          onRemoveMetadata(item.data.url, index)
                        }}
                      >
                        <ShieldCheck className="mr-1 size-3" />
                        {removingMetadataImageUrl === item.data.url ? "Cleaning..." : "Clean"}
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {fullscreenImage && (
        <FullscreenMediaViewer
          kind="image"
          url={fullscreenImage.url}
          metadata={{
            id: fullscreenImage.id,
            model: fullscreenImage.model ?? null,
            prompt: fullscreenImage.prompt ?? null,
            tool: fullscreenImage.tool ?? null,
            aspectRatio: fullscreenImage.aspectRatio ?? null,
            type: fullscreenImage.type ?? null,
            createdAt: fullscreenImage.createdAt ?? null,
          }}
          referenceImages={(fullscreenImage.referenceImageUrls ?? []).map((imageUrl) => ({ imageUrl }))}
          onClose={() => setFullscreenImage(null)}
          copiedUrl={copiedImageUrl}
          actions={({ url, metadata }): FullscreenMediaViewerAction[] => {
            const imageIndexByUrl = normalizedImages.findIndex((img) => img.url === url)
            const itemData = imageIndexByUrl !== -1 ? normalizedImages[imageIndexByUrl] : null
            const actions: FullscreenMediaViewerAction[] = []

            // Copy Prompt
            if (metadata.prompt) {
              actions.push({
                id: "copy-prompt",
                label: copiedPromptKey === `${url}-fs-prompt` ? "Prompt Copied" : "Copy Prompt",
                icon: <Copy className="size-4" />,
                onClick: () => {
                  if (metadata.prompt) {
                    void handleCopyPrompt(metadata.prompt, `${url}-fs-prompt`)
                  }
                },
              })
            }

            // Save Example
            if (onSaveExample && imageIndexByUrl !== -1) {
              actions.push({
                id: "save-example",
                label: "Save Example",
                icon: <Sparkle className="size-4" weight="regular" />,
                onClick: () => onSaveExample(url, imageIndexByUrl),
              })
            }

            // Use as Reference
            if ((onUseAsReference || isAgentMode) && itemData && imageIndexByUrl !== -1) {
              actions.push({
                id: "reference",
                label: "Use as Reference",
                icon: <ImageSquare className="size-4" />,
                onClick: () => runReferenceAction(itemData, imageIndexByUrl),
              })
            }

            // Edit
            if (onEdit && itemData && imageIndexByUrl !== -1) {
              actions.push({
                id: "edit",
                label: "Edit Image",
                icon: <PencilSimple className="size-4" />,
                onClick: () => runEditAction(itemData, imageIndexByUrl),
              })
            }

            // Recreate
            if ((onRecreate || isAgentMode) && itemData && imageIndexByUrl !== -1) {
              actions.push({
                id: "recreate",
                label: "Recreate",
                icon: <ArrowsClockwise className="size-4" />,
                onClick: () => runRecreateAction(itemData, imageIndexByUrl),
              })
            }

            // Animate
            if (itemData && imageIndexByUrl !== -1) {
              actions.push({
                id: "animate",
                label: "Animate Video",
                icon: <Play className="size-4" weight="fill" />,
                onClick: () => runAnimateAction(itemData, imageIndexByUrl),
              })
            }

            // Upscale
            if (onUpscale && imageIndexByUrl !== -1) {
              actions.push({
                id: "upscale",
                label: upscalingImageUrl === url ? "Upscaling..." : "Upscale Image",
                icon: <MagnifyingGlassPlus className="size-4" />,
                disabled: upscalingImageUrl === url,
                onClick: () => onUpscale(url, imageIndexByUrl),
              })
            }

            // Remove Background
            if (onRemoveBackground && itemData && imageIndexByUrl !== -1) {
              actions.push({
                id: "remove-background",
                label: removingBackgroundImageUrl === url ? "Removing BG..." : "Remove Background",
                icon: <Eraser className="size-4" />,
                disabled: removingBackgroundImageUrl === url,
                onClick: () => runRemoveBackgroundAction(itemData, imageIndexByUrl),
              })
            }

            // Remove Metadata
            if (onRemoveMetadata && imageIndexByUrl !== -1) {
              actions.push({
                id: "remove-metadata",
                label: removingMetadataImageUrl === url ? "Cleaning..." : "Remove Metadata",
                icon: <ShieldCheck className="size-4" />,
                disabled: removingMetadataImageUrl === url,
                onClick: () => onRemoveMetadata(url, imageIndexByUrl),
              })
            }

            // Save to Assets
            if (onCreateAsset && imageIndexByUrl !== -1) {
              actions.push({
                id: "save-to-assets",
                label: isAgentMode ? "Save to Assets" : "Create Asset",
                icon: <Plus className="size-4" />,
                onClick: () => onCreateAsset(url, imageIndexByUrl),
              })
            }

            if (fanvueActions && imageIndexByUrl !== -1) {
              actions.push({
                id: "fanvue-vault",
                label: "Send to Fanvue Vault",
                icon: <Vault className="size-4" />,
                onClick: () => fanvueActions.onSendToVault(url, imageIndexByUrl),
              })
              actions.push({
                id: "fanvue-post",
                label: "Create Fanvue Post",
                icon: <PaperPlaneTilt className="size-4" />,
                onClick: () => fanvueActions.onCreatePost(url, imageIndexByUrl),
              })
            }

            // Copy Image
            actions.push({
              id: "copy",
              label: "Copy Image",
              icon: <Copy className="size-4" />,
              onClick: () => void handleCopy(url),
            })

            // Download
            actions.push({
              id: "download",
              label: "Download",
              icon: <DownloadSimple className="size-4" />,
              onClick: () => void handleDownload(url),
            })

            // Delete
            if (onDelete && metadata.id) {
              const imageIndexById = normalizedImages.findIndex((img) => img.id === metadata.id)
              if (imageIndexById !== -1) {
                actions.push({
                  id: "delete",
                  label: deletingImageId === metadata.id ? "Deleting..." : "Delete",
                  icon: <Trash className="size-4" />,
                  destructive: true,
                  disabled: deletingImageId === metadata.id,
                  onClick: () => {
                    requestDelete(metadata.id!, url, imageIndexById)
                  },
                })
              }
            }

            return actions
          }}
        />
      )}

      <AlertDialog
        open={pendingDeleteImage !== null}
        onOpenChange={(open) => {
          if (!open && !deletingImageId) {
            setPendingDeleteImage(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this image?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the generation from your history and deletes its stored file. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingImageId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={Boolean(deletingImageId)}
              onClick={(event) => {
                event.preventDefault()
                void confirmDelete()
              }}
            >
              {deletingImageId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
