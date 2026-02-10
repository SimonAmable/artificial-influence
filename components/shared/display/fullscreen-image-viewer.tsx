"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, DownloadSimple, Copy, Trash, Plus, Check, CalendarBlank } from "@phosphor-icons/react"

interface FullscreenImageViewerProps {
  imageUrl: string
  metadata: {
    id?: string
    model: string | null
    prompt: string | null
    tool?: string | null
    aspectRatio?: string | null
    type?: string | null
    createdAt?: string | null
  }
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

// Normalize tool names
function normalizeToolName(tool: string | null | undefined): string {
  if (!tool) return 'Unknown Tool'
  
  return tool
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function FullscreenImageViewer({
  imageUrl,
  metadata,
  onClose,
  onDownload,
  onCopy,
  onDelete,
  onSaveToAssets,
  copiedImageUrl,
  deletingImageId,
}: FullscreenImageViewerProps) {
  const canDelete = Boolean(metadata.id && onDelete)
  const canSaveToAssets = Boolean(onSaveToAssets)

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative flex h-full w-full flex-col lg:flex-row lg:justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image Container */}
        <div className="flex flex-1 items-center justify-center p-4 lg:p-8">
          <img
            src={imageUrl}
            alt="Full screen preview"
            className="max-h-[70vh] max-w-full rounded-lg object-contain lg:max-h-[90vh] lg:max-w-[70vw]"
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
            {/* Information Section */}
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Tool</p>
                <Badge variant="secondary" className="text-xs">
                  {normalizeToolName(metadata.tool)}
                </Badge>
              </div>

              {metadata.model && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Model</p>
                  <Badge variant="outline" className="text-xs">
                    {normalizeModelName(metadata.model)}
                  </Badge>
                </div>
              )}

              {metadata.aspectRatio && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Size</p>
                  <p className="text-sm text-foreground">{metadata.aspectRatio}</p>
                </div>
              )}

              {metadata.createdAt && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Created</p>
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <CalendarBlank className="size-4 text-muted-foreground" />
                    {formatDate(metadata.createdAt)}
                  </div>
                </div>
              )}

              {metadata.prompt && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Prompt</p>
                  <p className="max-h-32 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
                    {metadata.prompt}
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
                  onDownload(imageUrl)
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
                  onCopy(imageUrl)
                }}
              >
                {copiedImageUrl === imageUrl ? (
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
                    onSaveToAssets?.(imageUrl)
                  }}
                >
                  <Plus className="size-4" />
                  Save to Assets
                </Button>
              )}

              {canDelete && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (metadata.id) {
                      onDelete?.(metadata.id, imageUrl)
                    }
                  }}
                  disabled={deletingImageId === metadata.id}
                >
                  <Trash className="size-4" />
                  {deletingImageId === metadata.id ? 'Deleting...' : 'Delete'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
