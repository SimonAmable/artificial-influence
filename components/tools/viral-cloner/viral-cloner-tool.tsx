"use client"

import * as React from "react"
import { toast } from "sonner"

import { AssetSelectionModal, type AssetSelectionPick } from "@/components/shared/modals/asset-selection-modal"
import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import { useAIChatDockInsetRight } from "@/components/ai-chat"
import { ensureStoredReferenceImage } from "@/lib/image/ensure-stored-reference-image"
import { isStoredReferenceImageUrl } from "@/lib/image/is-stored-reference-image-url"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { consumeViralClonerHandoff } from "@/lib/viral-cloner/handoff"
import { GENJUTSU_MAX_SECONDS, GENJUTSU_MIN_SECONDS } from "@/lib/viral-cloner/constants"
import { quoteViralCloneSelection } from "@/lib/viral-cloner/pricing"
import type { ViralClonerTrimSelection } from "@/lib/viral-cloner/types"

import { ViralClonerInputBox } from "./viral-cloner-input-box"
import { ViralClonerTargetGrid, type ViralClonerTargetItem } from "./viral-cloner-target-grid"

type InspectMedia = {
  index: number
  kind: "image" | "video" | "animated"
  remoteUrl: string
  previewUrl: string | null
  durationSeconds: number | null
}

type JobItem = {
  id: string
  item_index: number
  media_kind: string
  status: string
  output_url: string | null
  error_message: string | null
  quoted_credits: number
}

export function ViralClonerTool() {
  const chatDockInsetRight = useAIChatDockInsetRight()
  const fixedPromptPanelStyle = React.useMemo(
    () => ({ right: chatDockInsetRight }),
    [chatDockInsetRight],
  )

  const [characterAssetId, setCharacterAssetId] = React.useState<string | null>(null)
  const [referenceImage, setReferenceImage] = React.useState<ImageUpload | null>(null)
  const [assetModalOpen, setAssetModalOpen] = React.useState(false)
  const [sourceUrl, setSourceUrl] = React.useState("")
  const [importId, setImportId] = React.useState<string | null>(null)
  const [media, setMedia] = React.useState<InspectMedia[]>([])
  const [selected, setSelected] = React.useState<Set<number>>(new Set())
  const [trims, setTrims] = React.useState<Record<number, ViralClonerTrimSelection>>({})
  const [quote, setQuote] = React.useState<ReturnType<typeof quoteViralCloneSelection> | null>(null)
  const [acceptedRights, setAcceptedRights] = React.useState(false)
  const [inspecting, setInspecting] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [jobId, setJobId] = React.useState<string | null>(null)
  const [jobStatus, setJobStatus] = React.useState<string | null>(null)
  const [jobError, setJobError] = React.useState<string | null>(null)
  const [jobItems, setJobItems] = React.useState<JobItem[]>([])

  React.useEffect(() => {
    const handoff = consumeViralClonerHandoff()
    if (handoff?.characterAssetId) setCharacterAssetId(handoff.characterAssetId)
    if (handoff?.characterPreviewUrl) setReferenceImage({ url: handoff.characterPreviewUrl })
  }, [])

  const inspectDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const runInspect = React.useCallback(async (url: string) => {
    setInspecting(true)
    try {
      const response = await fetch("/api/viral-cloner/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: url }),
      })
      const payload = (await response.json()) as {
        error?: string
        importId?: string
        media?: InspectMedia[]
      }
      if (!response.ok) throw new Error(payload.error ?? "Inspection failed.")
      setImportId(payload.importId ?? null)
      const items = payload.media ?? []
      setMedia(items)
      setSelected(new Set(items.map((item) => item.index)))
      setTrims({})
      setJobId(null)
      setJobItems([])
      setJobStatus(null)
      setJobError(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Inspection failed.")
      setImportId(null)
      setMedia([])
    } finally {
      setInspecting(false)
    }
  }, [])

  React.useEffect(() => {
    const trimmed = sourceUrl.trim()
    if (!trimmed) return
    if (inspectDebounceRef.current) clearTimeout(inspectDebounceRef.current)
    inspectDebounceRef.current = setTimeout(() => void runInspect(trimmed), 600)
    return () => {
      if (inspectDebounceRef.current) clearTimeout(inspectDebounceRef.current)
    }
  }, [sourceUrl, runInspect])

  React.useEffect(() => {
    if (media.length === 0) {
      setQuote(null)
      return
    }
    const indexes = Array.from(selected)
    if (indexes.length === 0) {
      setQuote(null)
      return
    }
    try {
      setQuote(
        quoteViralCloneSelection({
          items: media.map((item) => ({
            index: item.index,
            kind: item.kind,
            durationSeconds: item.durationSeconds,
          })),
          selectedIndexes: indexes,
          trims,
          includeImportFee: true,
        }),
      )
    } catch {
      setQuote(null)
    }
  }, [selected, media, trims])

  React.useEffect(() => {
    if (!jobId) return
    let cancelled = false
    const poll = async () => {
      const response = await fetch(`/api/viral-cloner/${jobId}`)
      if (!response.ok || cancelled) return
      const payload = (await response.json()) as {
        job?: { status?: string; error_message?: string | null }
        items?: JobItem[]
      }
      setJobStatus(payload.job?.status ?? null)
      setJobError(payload.job?.error_message ?? null)
      setJobItems(payload.items ?? [])
    }
    void poll()
    const id = window.setInterval(() => void poll(), 3000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [jobId])

  function toggleSelected(index: number) {
    if (jobId) return
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function needsTrim(item: InspectMedia): boolean {
    if (item.kind === "image") return false
    const duration = item.durationSeconds
    return duration != null && duration > GENJUTSU_MAX_SECONDS
  }

  function updateTrim(index: number, patch: Partial<ViralClonerTrimSelection>) {
    setTrims((current) => {
      const item = media.find((m) => m.index === index)
      const duration = item?.durationSeconds ?? GENJUTSU_MAX_SECONDS
      const existing = current[index] ?? {
        startSeconds: 0,
        endSeconds: Math.min(duration, GENJUTSU_MAX_SECONDS),
      }
      return { ...current, [index]: { ...existing, ...patch } }
    })
  }

  const hasCharacter = Boolean(characterAssetId || referenceImage?.url || referenceImage?.file)
  const selectedCount = selected.size
  const ctaCredits = quote?.totalCredits ?? 0
  const isReady =
    Boolean(importId) && hasCharacter && selectedCount > 0 && acceptedRights && !inspecting && !jobId

  const gridItems = React.useMemo((): ViralClonerTargetItem[] => {
    return media.map((item) => {
      const jobItem = jobItems.find((row) => row.item_index === item.index)
      return {
        index: item.index,
        kind: item.kind,
        previewUrl: item.previewUrl,
        remoteUrl: item.remoteUrl,
        durationSeconds: item.durationSeconds,
        selected: selected.has(item.index),
        jobStatus: jobItem?.status ?? null,
        outputUrl: jobItem?.output_url ?? null,
        errorMessage: jobItem?.error_message ?? jobError,
      }
    })
  }, [jobError, jobId, jobItems, media, selected])

  async function resolveCharacterForSubmit(): Promise<{
    characterAssetId: string | null
    characterStoragePath: string | null
  }> {
    if (characterAssetId) {
      return { characterAssetId, characterStoragePath: null }
    }
    if (!referenceImage) {
      throw new Error("Choose a reference character.")
    }
    if (referenceImage.file) {
      const uploaded = await uploadFileToSupabase(referenceImage.file, "reference-images")
      if (!uploaded?.storagePath) {
        throw new Error("Could not upload character image.")
      }
      return { characterAssetId: null, characterStoragePath: uploaded.storagePath }
    }
    const stored = await ensureStoredReferenceImage(referenceImage)
    if (!stored?.url) {
      throw new Error("Choose a reference character.")
    }
    if (isStoredReferenceImageUrl(stored.url)) {
      return { characterAssetId: null, characterStoragePath: stored.url }
    }
    throw new Error("Upload your character image or pick one from the library.")
  }

  async function onSubmit() {
    if (!importId || !hasCharacter || selectedCount === 0 || !acceptedRights) {
      toast.error("Choose a character, select media, and confirm rights to use.")
      return
    }
    for (const index of selected) {
      const item = media.find((m) => m.index === index)
      if (item && needsTrim(item) && !trims[index]) {
        toast.error(`Set a trim for item ${index + 1} (over ${GENJUTSU_MAX_SECONDS}s).`)
        return
      }
    }
    setSubmitting(true)
    try {
      const character = await resolveCharacterForSubmit()
      const response = await fetch("/api/viral-cloner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importId,
          characterAssetId: character.characterAssetId,
          characterStoragePath: character.characterStoragePath,
          selectedItemIndexes: Array.from(selected),
          trims,
          acceptedRightToUse: true,
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      const payload = (await response.json()) as { error?: string; jobId?: string }
      if (!response.ok) throw new Error(payload.error ?? "Could not start cloning.")
      setJobId(payload.jobId ?? null)
      toast.success("Cloning started.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start cloning.")
    } finally {
      setSubmitting(false)
    }
  }

  async function retryItem(itemIndex: number) {
    if (!jobId) return
    try {
      const response = await fetch(`/api/viral-cloner/${jobId}/items/${itemIndex}/retry`, {
        method: "POST",
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? "Retry failed.")
      toast.success("Retry queued.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed.")
    }
  }

  function onAssetPick(pick: AssetSelectionPick) {
    setCharacterAssetId(pick.id ?? null)
    setReferenceImage({ url: pick.url })
    setAssetModalOpen(false)
  }

  const inputBox = (
    <ViralClonerInputBox
      referenceImage={referenceImage}
      onReferenceImageChange={(next) => {
        setReferenceImage(next)
        if (next?.file) setCharacterAssetId(null)
      }}
      onOpenLibrary={() => setAssetModalOpen(true)}
      sourceUrl={sourceUrl}
      onSourceUrlChange={setSourceUrl}
      inspecting={inspecting}
      acceptedRights={acceptedRights}
      onAcceptedRightsChange={setAcceptedRights}
      selectedCount={selectedCount}
      creditTotal={ctaCredits}
      isReady={isReady}
      isSubmitting={submitting}
      onGenerate={() => void onSubmit()}
    />
  )

  const showcase = (
    <div className="flex min-h-0 flex-col gap-3 pb-44 lg:pb-32">
      {jobId ? (
        <p className="text-xs text-muted-foreground px-1">
          Job {jobId.slice(0, 8)}… · {jobStatus ?? "starting"}
        </p>
      ) : null}
      <ViralClonerTargetGrid
        items={gridItems}
        characterFaceUrl={referenceImage?.url ?? null}
        onToggleSelect={toggleSelected}
        onRetry={jobId ? retryItem : undefined}
      />
      {media.some((item) => selected.has(item.index) && needsTrim(item)) ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
          <p className="mb-2 font-medium text-foreground">Trim long videos (max {GENJUTSU_MAX_SECONDS}s)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {media
              .filter((item) => selected.has(item.index) && needsTrim(item))
              .map((item) => (
                <div key={item.index} className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Item {item.index + 1} start (s)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2"
                      value={trims[item.index]?.startSeconds ?? 0}
                      onChange={(e) => updateTrim(item.index, { startSeconds: Number(e.target.value) })}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">End (s)</span>
                    <input
                      type="number"
                      min={GENJUTSU_MIN_SECONDS}
                      max={item.durationSeconds ?? GENJUTSU_MAX_SECONDS}
                      step={0.1}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2"
                      value={
                        trims[item.index]?.endSeconds ??
                        Math.min(item.durationSeconds ?? GENJUTSU_MAX_SECONDS, GENJUTSU_MAX_SECONDS)
                      }
                      onChange={(e) => updateTrim(item.index, { endSeconds: Number(e.target.value) })}
                    />
                  </label>
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="flex h-[calc(100dvh-52px)] min-h-0 flex-col overflow-hidden bg-background px-3 sm:px-6">
      <ul className="sr-only" aria-live="polite">
        {quote?.lines.map((line) => (
          <li key={line.index}>
            Item {line.index + 1}: {line.credits} credits
          </li>
        ))}
      </ul>

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-auto overscroll-contain pt-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {showcase}
        </div>
      </div>

      <div
        className="pointer-events-none fixed bottom-0 left-0 z-50 p-4 sm:p-6"
        style={fixedPromptPanelStyle}
      >
        <div className="pointer-events-none mx-auto flex max-w-7xl justify-center">
          <div className="pointer-events-auto w-full max-w-sm sm:max-w-lg lg:max-w-4xl">{inputBox}</div>
        </div>
      </div>

      <AssetSelectionModal
        open={assetModalOpen}
        onOpenChange={setAssetModalOpen}
        presetCategory="character"
        onSelect={onAssetPick}
      />
    </div>
  )
}