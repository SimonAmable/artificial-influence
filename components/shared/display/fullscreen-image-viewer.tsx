"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, DownloadSimple, Copy, Trash, Plus, Check, CalendarBlank, ImageSquare } from "@phosphor-icons/react"

export type ImageViewerMetadata = {
  id?: string
  model: string | null
  prompt: string | null
  tool?: string | null
  aspectRatio?: string | null
  type?: string | null
  createdAt?: string | null
}

export type ReferenceImageItem = {
  imageUrl: string
  metadata?: Partial<ImageViewerMetadata>
}

interface FullscreenImageViewerProps {
  imageUrl: string
  metadata: ImageViewerMetadata
  referenceImages?: ReferenceImageItem[]
  onClose: () => void
  onDownload: (imageUrl: string) => void
  onCopy: (imageUrl: string) => void
  onDelete?: (id: string, imageUrl: string) => void
  onSaveToAssets?: (imageUrl: string) => void
  copiedImageUrl?: string | null
  deletingImageId?: string | null
}

// Normalize model names by removing prefix before slash, replacing dashes with spaces, and capitalizing
function normalizeModelName(name: string): string {
  const nameAfterSlash = name.includes('/') ? name.split('/').slice(1).join('/') : name
  
  return nameAfterSlash
    .replace(/\-/g, ' ')
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Format date to human-readable format
function formatDate(dateString: string | null): string {
  if (!dateString) return 'Unknown date'
  
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  // Format time
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
  
  if (diffDays === 0) {
    return `Today at ${timeStr}`
  } else if (diffDays === 1) {
    return `Yesterday at ${timeStr}`
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }
}

// Normalize tool names; show type-based fallback when tool is missing (e.g. legacy rows)
function normalizeToolName(
  tool: string | null | undefined,
  fallbackType?: string | null
): string {
  const value = (typeof tool === 'string' && tool.trim()) ? tool : null
  if (value) {
    return value
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  if (fallbackType === 'image') return 'Image'
  if (fallbackType === 'video') return 'Video'
  if (fallbackType === 'audio') return 'Audio'
  return 'Unknown Tool'
}

export function FullscreenImageViewer({
  imageUrl,
  metadata,
  referenceImages = [],
  onClose,
  onDownload,
  onCopy,
  onDelete,
  onSaveToAssets,
  copiedImageUrl,
  deletingImageId,
}: FullscreenImageViewerProps) {
  // activeRefIndex: null = main image, 0..n = reference image index
  const [activeRefIndex, setActiveRefIndex] = React.useState<number | null>(null)

  const hasRefs = referenceImages.length > 0
  const currentImageUrl = activeRefIndex === null
    ? imageUrl
    : referenceImages[activeRefIndex]?.imageUrl ?? imageUrl
  const currentMetadata: ImageViewerMetadata = activeRefIndex === null
    ? metadata
    : { ...metadata, ...referenceImages[activeRefIndex]?.metadata }

  const canDelete = Boolean(currentMetadata.id && onDelete)
  const canSaveToAssets = Boolean(onSaveToAssets)

  return (
    <div
      className="fixed inset-0 z-60 flex flex-col overflow-y-auto overscroll-contain bg-black/90 backdrop-blur-sm lg:flex-row lg:items-center lg:justify-center lg:overflow-hidden"
      onClick={onClose}
    >
      <div 
        className="relative flex min-h-full min-w-full flex-col lg:flex-row lg:min-h-0 lg:h-full lg:w-full lg:flex-1 lg:justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image Container - click outside image (on this div) closes viewer */}
        <div
          className="flex min-h-0 flex-1 items-center justify-center p-4 lg:p-8"
          onClick={onClose}
        >
          <img
            src={currentImageUrl}
            alt="Full screen preview"
            className="max-h-[70vh] max-w-full rounded-lg object-contain lg:max-h-[90vh] lg:max-w-[70vw]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Sidebar */}
        <div className="flex h-auto w-full flex-col bg-background lg:h-full lg:w-[360px] lg:border-l lg:border-border">
          {/* Close button - top right on desktop, top left on mobile */}
          <div className="flex items-center justify-between p-4">
            <h3 className="text-sm font-semibold text-foreground">Image Details</h3>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Reference images preview */}
            {hasRefs && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <ImageSquare className="size-3.5" />
                  Reference images
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveRefIndex(null)
                    }}
                    className={cn(
                      "relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 bg-muted transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring",
                      activeRefIndex === null
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border"
                    )}
                    aria-label="View main image"
                  >
                    <img
                      src={imageUrl}
                      alt="Main"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 text-[10px] text-center text-white">
                      Main
                    </span>
                  </button>
                  {referenceImages.map((refImg, idx) => (
                    <button
                      key={refImg.imageUrl + idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveRefIndex(idx)
                      }}
                      className={cn(
                        "relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 bg-muted transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring",
                        activeRefIndex === idx
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border"
                      )}
                      aria-label={`View reference image ${idx + 1}`}
                    >
                      <img
                        src={refImg.imageUrl}
                        alt={`Reference ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 text-[10px] text-center text-white">
                        {idx + 1}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Information Section */}
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Tool</p>
                <Badge variant="secondary" className="text-xs">
                  {normalizeToolName(currentMetadata.tool, currentMetadata.type)}
                </Badge>
              </div>

              {currentMetadata.model && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Model</p>
                  <Badge variant="outline" className="text-xs">
                    {normalizeModelName(currentMetadata.model)}
                  </Badge>
                </div>
              )}

              {currentMetadata.aspectRatio && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Size</p>
                  <p className="text-sm text-foreground">{currentMetadata.aspectRatio}</p>
                </div>
              )}

              {currentMetadata.createdAt && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Created</p>
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <CalendarBlank className="size-4 text-muted-foreground" />
                    {formatDate(currentMetadata.createdAt)}
                  </div>
                </div>
              )}

              {currentMetadata.prompt && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Prompt</p>
                  <p className="max-h-32 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
                    {currentMetadata.prompt}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Actions Section */}
          <div className="p-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Actions</p>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-full justify-start gap-2"
                onClick={(e) => {
                  e.stopPropagation()
                  onDownload(currentImageUrl)
                }}
              >
                <DownloadSimple className="size-4" />
                Download
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-full justify-start gap-2"
                onClick={(e) => {
                  e.stopPropagation()
                  onCopy(currentImageUrl)
                }}
              >
                {copiedImageUrl === currentImageUrl ? (
                  <>
                    <Check className="size-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-4" />
                    Copy
                  </>
                )}
              </Button>

              {canSaveToAssets && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-full justify-start gap-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSaveToAssets?.(currentImageUrl)
                  }}
                >
                  <Plus className="size-4" />
                  Save to Assets
                </Button>
              )}

              {canDelete && currentMetadata.id && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete?.(currentMetadata.id!, currentImageUrl)
                  }}
                  disabled={deletingImageId === currentMetadata.id}
                >
                  <Trash className="size-4" />
                  {deletingImageId === currentMetadata.id ? 'Deleting...' : 'Delete'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
