"use client"

import * as React from "react"
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
} from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import { cn } from "@/lib/utils"
import {
  cropPercentToAspect,
  resolveCropAspect,
  type CropAspectPresetId,
} from "@/lib/image-editor/crop-aspect-options"
import { convertCropToNaturalPixels } from "@/lib/image-editor/crop-pixel-utils"
import type { CroppedAreaPixels } from "@/lib/utils/crop-image"

interface ImageEditorCropOverlayProps {
  imageSrc: string
  aspectPreset: CropAspectPresetId
  className?: string
  onCropAreaChange: (area: CroppedAreaPixels | null) => void
}

export type ImageEditorCropOverlayHandle = {
  getPixelCrop: () => CroppedAreaPixels | null
}

function makeInitialCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number | undefined
): Crop {
  if (aspect === undefined) {
    return { unit: "%", x: 0, y: 0, width: 100, height: 100 }
  }

  return centerCrop(
    makeAspectCrop(
      { unit: "%", width: 100 },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  )
}

function fitMediaInBounds(
  mediaWidth: number,
  mediaHeight: number,
  boundsWidth: number,
  boundsHeight: number
): { width: number; height: number } {
  if (
    mediaWidth <= 0 ||
    mediaHeight <= 0 ||
    boundsWidth <= 0 ||
    boundsHeight <= 0
  ) {
    return { width: 0, height: 0 }
  }

  const scale = Math.min(
    boundsWidth / mediaWidth,
    boundsHeight / mediaHeight,
    1
  )

  return {
    width: Math.max(1, Math.floor(mediaWidth * scale)),
    height: Math.max(1, Math.floor(mediaHeight * scale)),
  }
}

export const ImageEditorCropOverlay = React.forwardRef<
  ImageEditorCropOverlayHandle,
  ImageEditorCropOverlayProps
>(function ImageEditorCropOverlay(
  { imageSrc, aspectPreset, className, onCropAreaChange },
  ref
) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const imgRef = React.useRef<HTMLImageElement>(null)
  const [crop, setCrop] = React.useState<Crop>()
  const [mediaSize, setMediaSize] = React.useState<{
    width: number
    height: number
  } | null>(null)
  const [containerSize, setContainerSize] = React.useState({
    width: 0,
    height: 0,
  })
  const [shiftLockAspect, setShiftLockAspect] = React.useState<
    number | undefined
  >(undefined)
  const cropRef = React.useRef(crop)
  const mediaSizeRef = React.useRef(mediaSize)

  const displaySize = React.useMemo(() => {
    if (!mediaSize) return null
    return fitMediaInBounds(
      mediaSize.width,
      mediaSize.height,
      containerSize.width,
      containerSize.height
    )
  }, [containerSize.height, containerSize.width, mediaSize])

  const lockedAspect = React.useMemo(() => {
    if (!mediaSize) return undefined
    return resolveCropAspect(
      aspectPreset,
      mediaSize.width / mediaSize.height
    )
  }, [aspectPreset, mediaSize])

  cropRef.current = crop
  mediaSizeRef.current = mediaSize

  const activeAspect = lockedAspect ?? shiftLockAspect

  const syncPixelCrop = React.useCallback(
    (nextCrop: Crop) => {
      const image = imgRef.current
      if (!image) return
      onCropAreaChange(convertCropToNaturalPixels(nextCrop, image))
    },
    [onCropAreaChange]
  )

  React.useImperativeHandle(
    ref,
    () => ({
      getPixelCrop: () => {
        if (!crop || !imgRef.current) return null
        return convertCropToNaturalPixels(crop, imgRef.current)
      },
    }),
    [crop]
  )

  React.useEffect(() => {
    const captureShiftLockAspect = () => {
      if (lockedAspect !== undefined) return

      const currentCrop = cropRef.current
      const currentMedia = mediaSizeRef.current
      if (!currentCrop || !currentMedia) return

      const aspect = cropPercentToAspect(
        currentCrop,
        currentMedia.width,
        currentMedia.height
      )
      if (aspect !== undefined) {
        setShiftLockAspect(aspect)
      }
    }

    const releaseShiftLockAspect = () => {
      setShiftLockAspect(undefined)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Shift" || event.repeat) return
      captureShiftLockAspect()
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        releaseShiftLockAspect()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", releaseShiftLockAspect)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", releaseShiftLockAspect)
    }
  }, [lockedAspect])

  const handleCropChange = React.useCallback(
    (nextCrop: Crop) => {
      setCrop(nextCrop)
      syncPixelCrop(nextCrop)
    },
    [syncPixelCrop]
  )

  const handleImageLoad = React.useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = event.currentTarget
      setMediaSize({ width: naturalWidth, height: naturalHeight })
    },
    []
  )

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect()
      if (width > 0 && height > 0) {
        setContainerSize({ width, height })
      }
    }

    updateSize()

    const resizeObserver = new ResizeObserver(() => {
      updateSize()
    })
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [])

  React.useEffect(() => {
    setCrop(undefined)
    setMediaSize(null)
    setShiftLockAspect(undefined)
    onCropAreaChange(null)
  }, [imageSrc, onCropAreaChange])

  React.useEffect(() => {
    if (!mediaSize) return

    setShiftLockAspect(undefined)

    const aspect = resolveCropAspect(
      aspectPreset,
      mediaSize.width / mediaSize.height
    )
    const nextCrop = makeInitialCrop(
      mediaSize.width,
      mediaSize.height,
      aspect
    )
    setCrop(nextCrop)
  }, [aspectPreset, mediaSize])

  React.useLayoutEffect(() => {
    if (!crop || !displaySize || !imgRef.current) return
    syncPixelCrop(crop)
  }, [crop, displaySize, syncPixelCrop])

  const imageStyle = displaySize
    ? {
        width: displaySize.width,
        height: displaySize.height,
        display: "block" as const,
      }
    : undefined

  const ready = Boolean(crop && displaySize)

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute inset-0 z-20 min-h-0 overflow-hidden bg-zinc-950",
        className
      )}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="flex h-full w-full min-h-0 items-center justify-center">
        {ready ? (
          <ReactCrop
            crop={crop}
            aspect={activeAspect}
            ruleOfThirds
            keepSelection
            style={{ width: displaySize!.width, height: displaySize!.height }}
            onChange={handleCropChange}
            className={cn(
              "[&_.ReactCrop__crop-selection]:border-primary",
              "[&_.ReactCrop__drag-handle]:h-3 [&_.ReactCrop__drag-handle]:w-3",
              "[&_.ReactCrop__drag-handle]:rounded-full [&_.ReactCrop__drag-handle]:border-2",
              "[&_.ReactCrop__drag-handle]:border-primary [&_.ReactCrop__drag-handle]:bg-background"
            )}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              style={imageStyle}
              onLoad={handleImageLoad}
            />
          </ReactCrop>
        ) : (
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop preview"
            className="max-h-full max-w-full opacity-0"
            onLoad={handleImageLoad}
          />
        )}
      </div>
    </div>
  )
})
