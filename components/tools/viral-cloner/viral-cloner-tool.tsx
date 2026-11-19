"use client"

import * as React from "react"
import { LinkSimple, UploadSimple } from "@phosphor-icons/react"
import { toast } from "sonner"

import { AssetSelectionModal, type AssetSelectionPick } from "@/components/shared/modals/asset-selection-modal"
import { PhotoUpload, type ImageUpload } from "@/components/shared/upload/photo-upload"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { consumeViralClonerHandoff } from "@/lib/viral-cloner/handoff"
import { GENJUTSU_MAX_SECONDS, GENJUTSU_MIN_SECONDS } from "@/lib/viral-cloner/constants"
import { quoteViralCloneSelection } from "@/lib/viral-cloner/pricing"
import type { ViralClonerTrimSelection } from "@/lib/viral-cloner/types"
import { cn } from "@/lib/utils"

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
  const [jobItems, setJobItems] = React.useState<JobItem[]>([])

  React.useEffect(() => {
    const handoff = consumeViralClonerHandoff()
    if (handoff?.characterAssetId) setCharacterAssetId(handoff.characterAssetId)
    if (handoff?.characterPreviewUrl) setReferenceImage({ url: handoff.characterPreviewUrl })
  }, [])

  const inspectDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    const trimmed = sourceUrl.trim()
    if (!trimmed) return
    if (inspectDebounceRef.current) clearTimeout(inspectDebounceRef.current)
    inspectDebounceRef.current = setTimeout(() => void runInspect(trimmed), 600)
    return () => {
      if (inspectDebounceRef.current) clearTimeout(inspectDebounceRef.current)
    }
  }, [sourceUrl])

  async function runInspect(url: string) {
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Inspection failed.")
      setImportId(null)
      setMedia([])
    } finally {
      setInspecting(false)
    }
  }

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
    } catch (error) {
      setQuote(null)
      if (error instanceof Error) toast.error(error.message)
    }
  }, [selected, media, trims])

  React.useEffect(() => {
    if (!jobId) return
    let cancelled = false
    const poll = async () => {
      const response = await fetch(`/api/viral-cloner/${jobId}`)
      if (!response.ok || cancelled) return
      const payload = (await response.json()) as {
        job?: { status?: string }
        items?: JobItem[]
      }
      setJobStatus(payload.job?.status ?? null)
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

  const hasCharacter = Boolean(characterAssetId || referenceImage?.url)
  const selectedCount = selected.size
  const ctaCredits = quote?.totalCredits ?? 0
  const ctaLabel =
    selectedCount > 0 && ctaCredits > 0
      ? `Clone ${selectedCount} item${selectedCount === 1 ? "" : "s"} · ${ctaCredits} credits`
      : "Clone"

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
      const response = await fetch("/api/viral-cloner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importId,
          characterAssetId,
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
      <Card className="flex min-h-0 flex-1 flex-col border-border/60 shadow-none">
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="space-y-2">
            <Label>Reference character</Label>
            <div className="flex flex-wrap items-center gap-2">
              <PhotoUpload
                value={referenceImage}
                onChange={(next) => {
                  setReferenceImage(next)
                  if (next?.file) setCharacterAssetId(null)
                }}
                className="h-28 w-28"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setAssetModalOpen(true)}>
                <UploadSimple className="mr-2 size-4" />
                Library
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="viral-source-url">Post URL</Label>
            <Input
              id="viral-source-url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://www.tiktok.com/..."
              className="font-mono text-sm"
            />
            {inspecting ? <p className="text-xs text-muted-foreground">Inspecting…</p> : null}
          </div>

          {media.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {media.map((item) => (
                <div
                  key={item.index}
                  className={cn(
                    "rounded-lg border p-2",
                    selected.has(item.index) ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleSelected(item.index)}
                    className="w-full text-left"
                  >
                    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        #{item.index + 1} · {item.kind}
                        {item.durationSeconds != null ? ` · ${item.durationSeconds}s` : ""}
                      </span>
                      <Checkbox checked={selected.has(item.index)} aria-hidden />
                    </div>
                    {item.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.previewUrl}
                        alt=""
                        className="aspect-video w-full rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex aspect-video items-center justify-center rounded-md bg-muted text-xs">
                        Video preview
                      </div>
                    )}
                  </button>
                  {selected.has(item.index) && needsTrim(item) ? (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <label className="space-y-1">
                        <span className="text-muted-foreground">Start (s)</span>
                        <Input
                          type="number"
                          min={0}
                          step={0.1}
                          value={trims[item.index]?.startSeconds ?? 0}
                          onChange={(e) =>
                            updateTrim(item.index, { startSeconds: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-muted-foreground">End (s)</span>
                        <Input
                          type="number"
                          min={GENJUTSU_MIN_SECONDS}
                          max={item.durationSeconds ?? GENJUTSU_MAX_SECONDS}
                          step={0.1}
                          value={
                            trims[item.index]?.endSeconds ??
                            Math.min(item.durationSeconds ?? GENJUTSU_MAX_SECONDS, GENJUTSU_MAX_SECONDS)
                          }
                          onChange={(e) =>
                            updateTrim(item.index, { endSeconds: Number(e.target.value) })
                          }
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t pt-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={acceptedRights} onCheckedChange={(v) => setAcceptedRights(v === true)} />
              I have the right to use this source media for cloning.
            </label>
            <Button
              type="button"
              disabled={submitting || !importId || !hasCharacter || selectedCount === 0 || !acceptedRights}
              onClick={() => void onSubmit()}
            >
              {submitting ? "Starting…" : ctaLabel}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full border-border/60 shadow-none lg:w-[360px]">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <LinkSimple className="size-4" />
            Outputs
          </div>
          {jobId ? (
            <p className="text-sm text-muted-foreground">
              Job {jobId.slice(0, 8)}… · {jobStatus ?? "starting"}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Confirm cloning to track each output here.</p>
          )}
          {jobItems.length > 0 ? (
            <ul className="space-y-2 text-xs">
              {jobItems.map((item) => (
                <li key={item.id} className="rounded border border-border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      Item {item.item_index + 1} · {item.status}
                    </span>
                    {item.status === "failed" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void retryItem(item.item_index)}
                      >
                        Retry
                      </Button>
                    ) : null}
                  </div>
                  {item.output_url ? (
                    <a
                      href={item.output_url}
                      className="mt-1 block truncate text-primary underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      View output
                    </a>
                  ) : null}
                  {item.error_message ? (
                    <p className="mt-1 text-destructive">{item.error_message}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {quote ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {quote.lines.map((line) => (
                <li key={line.index}>
                  Item {line.index + 1}: {line.credits} credits
                </li>
              ))}
              <li className="font-medium text-foreground">Total: {quote.totalCredits} credits (includes 1 import)</li>
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <AssetSelectionModal
        open={assetModalOpen}
        onOpenChange={setAssetModalOpen}
        presetCategory="character"
        onSelect={onAssetPick}
      />
    </div>
  )
}