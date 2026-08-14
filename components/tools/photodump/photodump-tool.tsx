"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { UploadSimple } from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  DEFAULT_PHOTODUMP_FORM,
  PhotodumpInputBox,
  type PhotodumpFormState,
} from "@/components/tools/photodump/photodump-input-box"
import { PhotodumpResultsPanel } from "@/components/tools/photodump/photodump-results-panel"
import {
  isInsufficientCreditsError,
  isInsufficientCreditsMessage,
} from "@/lib/generate-image-client"
import {
  toUserFacingGenerationError,
  tryShowContentModerationToast,
} from "@/lib/content-moderation-toast"
import { showCreditsUpsellToast } from "@/lib/pricing-upsell"
import { PHOTODUMP_CUSTOM_PRESET_ID } from "@/lib/photodump/constants"
import { isPhotodumpMetadata } from "@/lib/photodump/types"
import type { PhotodumpMetadata } from "@/lib/photodump/types"
import { cn } from "@/lib/utils"

const DRAG_PREVIEW_OFFSET_X = 18
const DRAG_PREVIEW_OFFSET_Y = 18

type PendingJob = {
  id: string
  shotCount: number
}

function getImageFileFromDataTransfer(dataTransfer: DataTransfer): File | null {
  for (const item of Array.from(dataTransfer.items ?? [])) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue
    const file = item.getAsFile()
    if (file) return file
  }

  for (const file of Array.from(dataTransfer.files ?? [])) {
    if (file.type.startsWith("image/")) return file
  }

  return null
}

export function PhotodumpTool() {
  const searchParams = useSearchParams()
  const referenceImageParam = searchParams.get("image")
  const [form, setForm] = React.useState<PhotodumpFormState>(DEFAULT_PHOTODUMP_FORM)
  const [pendingJobs, setPendingJobs] = React.useState<PendingJob[]>([])
  const [activeResult, setActiveResult] = React.useState<PhotodumpMetadata | null>(null)
  const [isDraggingFile, setIsDraggingFile] = React.useState(false)
  const [dragPreviewUrl, setDragPreviewUrl] = React.useState<string | null>(null)
  const dragCounterRef = React.useRef(0)
  const dragPreviewUrlRef = React.useRef<string | null>(null)
  const dragPreviewElRef = React.useRef<HTMLDivElement>(null)

  const activeSlotCount = pendingJobs.reduce((sum, job) => sum + job.shotCount, 0)
  const isGenerating = pendingJobs.length > 0

  const applyReferenceFile = React.useCallback((file?: File | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file")
      return
    }

    setForm((current) => ({
      ...current,
      referenceImage: {
        file,
        url: URL.createObjectURL(file),
      },
    }))
  }, [])

  React.useEffect(() => {
    if (!referenceImageParam) return

    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(referenceImageParam)
        if (!response.ok) return
        const blob = await response.blob()
        if (cancelled || !blob.type.startsWith("image/")) return
        const file = new File([blob], "reference.png", { type: blob.type })
        applyReferenceFile(file)
      } catch {
        // ignore prefetch failures
      }
    })()

    return () => {
      cancelled = true
    }
  }, [applyReferenceFile, referenceImageParam])

  const handlePageDragOver = React.useCallback((event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return
    event.preventDefault()
  }, [])

  const handlePageDragEnter = React.useCallback((event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return
    event.preventDefault()
    dragCounterRef.current += 1
    setIsDraggingFile(true)
    const file = getImageFileFromDataTransfer(event.dataTransfer)
    if (file) {
      const url = URL.createObjectURL(file)
      if (dragPreviewUrlRef.current) {
        URL.revokeObjectURL(dragPreviewUrlRef.current)
      }
      dragPreviewUrlRef.current = url
      setDragPreviewUrl(url)
    }
  }, [])

  const handlePageDragLeave = React.useCallback((event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return
    event.preventDefault()
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
    if (dragCounterRef.current === 0) {
      setIsDraggingFile(false)
      if (dragPreviewUrlRef.current) {
        URL.revokeObjectURL(dragPreviewUrlRef.current)
        dragPreviewUrlRef.current = null
      }
      setDragPreviewUrl(null)
    }
  }, [])

  const handlePageDrop = React.useCallback(
    (event: React.DragEvent) => {
      if (!event.dataTransfer.types.includes("Files")) return
      event.preventDefault()
      dragCounterRef.current = 0
      setIsDraggingFile(false)
      if (dragPreviewUrlRef.current) {
        URL.revokeObjectURL(dragPreviewUrlRef.current)
        dragPreviewUrlRef.current = null
      }
      setDragPreviewUrl(null)
      applyReferenceFile(getImageFileFromDataTransfer(event.dataTransfer))
    },
    [applyReferenceFile],
  )

  React.useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes("Files")) return
      const { clientX, clientY } = event
      const el = dragPreviewElRef.current
      if (el) {
        el.style.transform = `translate3d(${clientX + DRAG_PREVIEW_OFFSET_X}px, ${clientY + DRAG_PREVIEW_OFFSET_Y}px, 0) rotate(-8deg)`
      }
    }
    window.addEventListener("dragover", onDragOver)
    return () => window.removeEventListener("dragover", onDragOver)
  }, [])

  const handleGenerationFailure = React.useCallback((responseStatus: number | null, message: string) => {
    if (responseStatus === 402 || isInsufficientCreditsMessage(message)) {
      showCreditsUpsellToast({
        message,
        description: "Upgrade your plan to continue generating",
        toastId: "photodump-credits-upsell",
      })
      return
    }

    if (
      tryShowContentModerationToast(message, undefined, {
        toastId: "photodump-moderation-error",
      })
    ) {
      return
    }

    toast.error(toUserFacingGenerationError(message, "Generation failed. Please try again."))
  }, [])

  const runGenerate = React.useCallback(async () => {
    const reference = form.referenceImage
    if (!reference?.file && !reference?.url) {
      toast.error("Please upload a subject photo")
      return
    }

    if (!form.presetId) {
      toast.error("Please choose a preset")
      return
    }

    if (form.presetId === PHOTODUMP_CUSTOM_PRESET_ID && form.aestheticReferences.length === 0) {
      toast.error("Add at least one aesthetic reference for Custom")
      return
    }

    const jobId = crypto.randomUUID()
    const jobSnapshot: PendingJob = {
      id: jobId,
      shotCount: form.shotCount,
    }

    const formSnapshot = {
      aestheticReferences: form.aestheticReferences,
      aspectRatio: form.aspectRatio,
      model: form.model,
      note: form.note.trim(),
      presetId: form.presetId,
      referenceFile: reference.file ?? null,
      referenceUrl: reference.url ?? null,
      shotCount: form.shotCount,
    }

    setActiveResult(null)
    setPendingJobs((current) => [jobSnapshot, ...current])

    try {
      let referenceFile = formSnapshot.referenceFile
      if (!referenceFile && formSnapshot.referenceUrl) {
        const response = await fetch(formSnapshot.referenceUrl)
        if (!response.ok) {
          throw new Error("Failed to load subject photo")
        }
        const blob = await response.blob()
        const mimeType = blob.type.startsWith("image/") ? blob.type : "image/png"
        referenceFile = new File([blob], "reference.png", { type: mimeType })
      }

      if (!referenceFile) {
        throw new Error("Please upload a subject photo")
      }

      const formData = new FormData()
      formData.append("referenceImage", referenceFile)
      formData.append("presetId", formSnapshot.presetId)
      formData.append("aspectRatio", formSnapshot.aspectRatio)
      formData.append("shotCount", String(formSnapshot.shotCount))
      formData.append("model", formSnapshot.model)
      if (formSnapshot.note) {
        formData.append("note", formSnapshot.note)
      }

      for (const aestheticRef of formSnapshot.aestheticReferences) {
        if (aestheticRef.file) {
          formData.append("aestheticReferences", aestheticRef.file)
        }
      }

      const response = await fetch("/api/photodump/generate", {
        method: "POST",
        body: formData,
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const message =
          typeof data.message === "string"
            ? data.message
            : typeof data.error === "string"
              ? data.error
              : "Generation failed"
        handleGenerationFailure(response.status, message)
        return
      }

      if (!isPhotodumpMetadata(data.metadata)) {
        throw new Error("Invalid photodump response")
      }

      setActiveResult(data.metadata)
      toast.success("Photodump ready")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed"
      if (isInsufficientCreditsError(err) || isInsufficientCreditsMessage(message)) {
        showCreditsUpsellToast({
          message,
          description: "Upgrade your plan to continue generating",
          toastId: "photodump-credits-upsell",
        })
      } else if (
        !tryShowContentModerationToast(message, err, {
          toastId: "photodump-moderation-error",
        })
      ) {
        toast.error(toUserFacingGenerationError(message, "Generation failed. Please try again."))
      }
    } finally {
      setPendingJobs((current) => current.filter((job) => job.id !== jobId))
    }
  }, [form, handleGenerationFailure])

  return (
    <main
      className={cn(
        "relative box-border flex h-dvh max-h-dvh w-full flex-col overflow-hidden px-2 pb-4 pt-[52px] transition-colors sm:px-4",
        isDraggingFile && "bg-primary/5",
      )}
      onDragOver={handlePageDragOver}
      onDragEnter={handlePageDragEnter}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
    >
      {isDraggingFile ? (
        <div
          className="pointer-events-none absolute inset-2 top-[52px] z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 sm:inset-4 sm:top-[52px]"
          aria-live="polite"
          role="status"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/15">
              <UploadSimple className="size-8 text-primary" weight="bold" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">Drop subject photo</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your face locks from this upload
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {dragPreviewUrl ? (
        <div
          ref={dragPreviewElRef}
          className="pointer-events-none fixed left-0 top-0 z-60 will-change-transform"
          style={{ transform: "translate3d(-9999px, -9999px, 0) rotate(-8deg)" }}
          aria-hidden
        >
          <div className="overflow-hidden rounded-2xl border-[3px] border-primary bg-background shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob preview URL during drag */}
            <img
              src={dragPreviewUrl}
              alt=""
              draggable={false}
              className="block h-40 w-28 object-cover sm:h-48 sm:w-32"
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] lg:items-stretch lg:overflow-hidden">
        <div className="order-2 w-full min-w-0 shrink-0 lg:order-1 lg:min-h-0 lg:overflow-y-auto">
          <PhotodumpInputBox
            form={form}
            isGenerating={isGenerating}
            activeSlotCount={activeSlotCount}
            onChange={setForm}
            onGenerate={() => void runGenerate()}
          />
        </div>

        <div className="relative order-1 flex min-h-[70dvh] min-w-0 flex-1 flex-col lg:order-2 lg:min-h-0 lg:overflow-hidden">
          <PhotodumpResultsPanel
            activeShotCount={pendingJobs[0]?.shotCount ?? 0}
            completedMetadata={activeResult}
            isGenerating={isGenerating}
            className="h-full"
          />
        </div>
      </div>
    </main>
  )
}
