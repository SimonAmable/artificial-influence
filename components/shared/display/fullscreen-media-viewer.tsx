"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  CalendarBlank,
  Check,
  FilmStrip,
  ImageSquare,
  X,
} from "@phosphor-icons/react"
import {
  formatMediaDate,
  normalizeMediaModelName,
  normalizeMediaToolName,
  type FullscreenMediaKind,
} from "./media-viewer-utils"

export type MediaViewerMetadata = {
  id?: string
  model?: string | null
  prompt?: string | null
  tool?: string | null
  aspectRatio?: string | null
  type?: string | null
  createdAt?: string | null
}

export type MediaViewerReferenceImage = {
  imageUrl: string
  metadata?: Partial<MediaViewerMetadata>
}

export type FullscreenMediaViewerAction = {
  id: string
  label: string
  icon?: React.ReactNode
  onClick: (state: FullscreenMediaViewerState) => void
  disabled?: boolean
  destructive?: boolean
}

export type FullscreenMediaViewerState = {
  kind: FullscreenMediaKind
  url: string
  metadata: MediaViewerMetadata
  activeReferenceIndex: number | null
}

type FullscreenMediaViewerProps = {
  kind: FullscreenMediaKind
  url: string
  title?: string
  metadata?: MediaViewerMetadata
  referenceImages?: MediaViewerReferenceImage[]
  copiedUrl?: string | null
  onClose: () => void
  actions?: FullscreenMediaViewerAction[] | ((state: FullscreenMediaViewerState) => FullscreenMediaViewerAction[])
}

export function FullscreenMediaViewer({
  kind,
  url,
  title,
  metadata = {},
  referenceImages = [],
  copiedUrl,
  onClose,
  actions,
}: FullscreenMediaViewerProps) {
  const [activeReferenceIndex, setActiveReferenceIndex] = React.useState<number | null>(null)

  const hasReferences = referenceImages.length > 0
  const currentUrl =
    activeReferenceIndex === null
      ? url
      : referenceImages[activeReferenceIndex]?.imageUrl ?? url
  const currentMetadata: MediaViewerMetadata =
    activeReferenceIndex === null
      ? metadata
      : { ...metadata, ...referenceImages[activeReferenceIndex]?.metadata }

  const state = React.useMemo(
    () => ({
      kind,
      url: currentUrl,
      metadata: currentMetadata,
      activeReferenceIndex,
    }),
    [activeReferenceIndex, currentMetadata, currentUrl, kind],
  )

  const resolvedActions = React.useMemo(
    () => (typeof actions === "function" ? actions(state) : actions ?? []),
    [actions, state],
  )

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const heading = title || (kind === "video" ? "Video Details" : "Image Details")

  return (
    <div
      className="fixed inset-0 z-60 overflow-y-auto overscroll-contain bg-black/90 backdrop-blur-sm lg:flex lg:items-center lg:justify-center lg:overflow-hidden"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col lg:h-full lg:w-full lg:flex-row lg:justify-end"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-center justify-center p-4 lg:flex-1 lg:p-8"
          onClick={onClose}
        >
          {kind === "video" ? (
            <video
              src={currentUrl}
              controls
              playsInline
              preload="metadata"
              className="max-h-[85vh] max-w-full rounded-lg object-contain lg:max-h-[90vh] lg:max-w-[70vw]"
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <img
              src={currentUrl}
              alt={title || "Full screen preview"}
              className="max-h-[85vh] max-w-full rounded-lg object-contain lg:max-h-[90vh] lg:max-w-[70vw]"
              onClick={(event) => event.stopPropagation()}
            />
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col bg-background lg:h-full lg:w-[360px] lg:border-l lg:border-border">
          <div className="flex items-center justify-between p-4">
            <h3 className="truncate pr-3 text-sm font-semibold text-foreground">{heading}</h3>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {hasReferences && (
              <div className="mb-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <ImageSquare className="size-3.5" />
                  Reference images
                </p>
                <div className="flex flex-wrap gap-2">
                  <ReferenceThumb
                    active={activeReferenceIndex === null}
                    imageUrl={url}
                    label="Main"
                    onClick={() => setActiveReferenceIndex(null)}
                  />
                  {referenceImages.map((refImage, index) => (
                    <ReferenceThumb
                      key={`${refImage.imageUrl}-${index}`}
                      active={activeReferenceIndex === index}
                      imageUrl={refImage.imageUrl}
                      label={`${index + 1}`}
                      onClick={() => setActiveReferenceIndex(index)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Tool</p>
                <Badge variant="secondary" className="text-xs">
                  {normalizeMediaToolName(currentMetadata.tool, currentMetadata.type ?? kind)}
                </Badge>
              </div>

              {currentMetadata.model && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Model</p>
                  <Badge variant="outline" className="text-xs">
                    {normalizeMediaModelName(currentMetadata.model)}
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
                    {formatMediaDate(currentMetadata.createdAt)}
                  </div>
                </div>
              )}

              {kind === "video" && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <FilmStrip className="size-3.5" />
                    Playback
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Video controls are available directly on the preview.
                  </p>
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

          {resolvedActions.length > 0 && (
            <div className="p-4">
              <p className="mb-3 text-xs font-medium text-muted-foreground">Actions</p>
              <div className="flex flex-col gap-2">
                {resolvedActions.map((action) => {
                  const isCopied = copiedUrl === currentUrl && /copy/i.test(action.label)
                  return (
                    <Button
                      key={action.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-9 w-full justify-start gap-2",
                        action.destructive &&
                          "text-destructive hover:bg-destructive/10 hover:text-destructive",
                      )}
                      disabled={action.disabled}
                      onClick={(event) => {
                        event.stopPropagation()
                        action.onClick(state)
                      }}
                    >
                      {isCopied ? <Check className="size-4" /> : action.icon}
                      {isCopied ? "Copied" : action.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ReferenceThumb({
  active,
  imageUrl,
  label,
  onClick,
}: {
  active: boolean
  imageUrl: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        "relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 bg-muted transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring",
        active ? "border-primary ring-2 ring-primary/20" : "border-border",
      )}
      aria-label={label === "Main" ? "View main image" : `View reference image ${label}`}
    >
      <img src={imageUrl} alt={label} className="h-full w-full object-cover" />
      <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] text-white">
        {label}
      </span>
    </button>
  )
}
