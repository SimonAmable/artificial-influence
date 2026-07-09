"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon, Loader2 } from "lucide-react"
import { toast } from "sonner"

import type { FanvueConnectionItem, FanvueMediaItem } from "@/components/content/types"
import { FanvueAccountSelect } from "@/components/content/composer/fanvue-account-select"
import { VaultMediaPicker } from "@/components/content/composer/vault-media-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type FanvueComposerStepProps = {
  connection: FanvueConnectionItem
  connections: FanvueConnectionItem[]
  onConnectionChange: (connection: FanvueConnectionItem) => void
  onSuccess: () => void
  onGoToMediaTab: () => void
  initialScheduleDate?: Date
  defaultComposerTab?: "now" | "schedule"
  preselectedMediaUuid?: string | null
}

export function FanvueComposerStep({
  connection,
  connections,
  onConnectionChange,
  onSuccess,
  onGoToMediaTab,
  initialScheduleDate,
  defaultComposerTab = "now",
  preselectedMediaUuid = null,
}: FanvueComposerStepProps) {
  const [caption, setCaption] = React.useState("")
  const [audience, setAudience] = React.useState<"subscribers" | "followers-and-subscribers">("subscribers")
  const [selectedMedia, setSelectedMedia] = React.useState<FanvueMediaItem | null>(null)
  const [previewMedia, setPreviewMedia] = React.useState<FanvueMediaItem | null>(null)
  const [isPaid, setIsPaid] = React.useState(false)
  const [priceDollars, setPriceDollars] = React.useState("5")
  const [composerTab, setComposerTab] = React.useState<"now" | "schedule">(defaultComposerTab)
  const [scheduleDate, setScheduleDate] = React.useState<Date>(
    () => initialScheduleDate ?? new Date(Date.now() + 60 * 60 * 1000)
  )
  const [scheduleHour, setScheduleHour] = React.useState(
    String((initialScheduleDate ?? new Date(Date.now() + 60 * 60 * 1000)).getHours())
  )
  const [scheduleMinute, setScheduleMinute] = React.useState(
    String((initialScheduleDate ?? new Date(Date.now() + 60 * 60 * 1000)).getMinutes())
  )
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!preselectedMediaUuid || selectedMedia) return

    let cancelled = false
    void fetch(`/api/fanvue/media?connectionId=${encodeURIComponent(connection.id)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { items?: FanvueMediaItem[] }
        if (!response.ok || cancelled) return
        const match = (data.items ?? []).find((item) => item.uuid === preselectedMediaUuid)
        if (match) {
          setSelectedMedia(match)
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [connection.id, preselectedMediaUuid, selectedMedia])

  const handleConnectionChange = (next: FanvueConnectionItem) => {
    if (next.id === connection.id) return
    setSelectedMedia(null)
    setPreviewMedia(null)
    onConnectionChange(next)
  }

  const priceCents = React.useMemo(() => {
    const parsed = Number.parseFloat(priceDollars)
    if (!Number.isFinite(parsed) || parsed <= 0) return null
    return Math.round(parsed * 100)
  }, [priceDollars])

  const scheduledAtIso = React.useMemo(() => {
    if (composerTab !== "schedule") return undefined
    const next = new Date(scheduleDate)
    next.setHours(Number.parseInt(scheduleHour, 10) || 0, Number.parseInt(scheduleMinute, 10) || 0, 0, 0)
    return next.toISOString()
  }, [composerTab, scheduleDate, scheduleHour, scheduleMinute])

  const submit = async (action: "draft" | "publish" | "schedule") => {
    if (!selectedMedia?.uuid) {
      toast.error("Select media from your vault first.")
      return
    }

    if (isPaid && (!priceCents || priceCents < 300)) {
      toast.error("Paid posts must be at least $3.00.")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/content/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action === "schedule" ? "schedule" : action,
          fanvueConnectionId: connection.id,
          caption,
          audience,
          mediaUuids: [selectedMedia.uuid],
          mediaPreviewUuid: isPaid ? previewMedia?.uuid ?? null : null,
          priceCents: isPaid ? priceCents : null,
          thumbnailUrl: selectedMedia.thumbnailUrl,
          scheduledAt: action === "schedule" ? scheduledAtIso : undefined,
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to save post.")
      }

      toast.success(
        action === "publish"
          ? "Post published to Fanvue."
          : action === "schedule"
            ? "Post scheduled."
            : "Draft saved."
      )
      onSuccess()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save post.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
      <div className="space-y-2">
        <Label className="text-base font-semibold">Posting as</Label>
        <FanvueAccountSelect
          connections={connections}
          value={connection.id}
          onValueChange={handleConnectionChange}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-base font-semibold">Vault media</Label>
        <VaultMediaPicker
          connectionId={connection.id}
          selectedMediaUuid={selectedMedia?.uuid ?? null}
          previewMediaUuid={previewMedia?.uuid ?? null}
          onSelectMedia={setSelectedMedia}
          onUploaded={setSelectedMedia}
        />
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
          onClick={onGoToMediaTab}
        >
          Browse full media library
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fanvue-caption" className="text-base font-semibold">
          Caption
        </Label>
        <Textarea
          id="fanvue-caption"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Write your post text..."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-base font-semibold">Audience</Label>
        <Select value={audience} onValueChange={(value) => setAudience(value as typeof audience)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="subscribers">Subscribers only</SelectItem>
            <SelectItem value="followers-and-subscribers">Followers and subscribers</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/10 p-4">
        <div className="flex items-center gap-2">
          <Checkbox id="fanvue-paid" checked={isPaid} onCheckedChange={(checked) => setIsPaid(checked === true)} />
          <Label htmlFor="fanvue-paid">Paid post (PPV)</Label>
        </div>
        {isPaid ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="fanvue-price">Price (USD)</Label>
              <Input
                id="fanvue-price"
                type="number"
                min="3"
                step="0.01"
                value={priceDollars}
                onChange={(event) => setPriceDollars(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Minimum price is $3.00.</p>
            </div>
            <div className="space-y-2">
              <Label>Free preview media</Label>
              <VaultMediaPicker
                connectionId={connection.id}
                selectedMediaUuid={selectedMedia?.uuid ?? null}
                previewMediaUuid={previewMedia?.uuid ?? null}
                previewMode
                onSelectPreview={setPreviewMedia}
                onUploaded={setPreviewMedia}
              />
            </div>
          </div>
        ) : null}
      </div>

      <Tabs value={composerTab} onValueChange={(value) => setComposerTab(value as "now" | "schedule")}>
        <TabsList>
          <TabsTrigger value="now">Publish now</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>
      </Tabs>

      {composerTab === "schedule" ? (
        <div className="flex flex-wrap items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className={cn("justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(scheduleDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={scheduleDate} onSelect={(date) => date && setScheduleDate(date)} />
            </PopoverContent>
          </Popover>
          <Input
            type="number"
            min="0"
            max="23"
            value={scheduleHour}
            onChange={(event) => setScheduleHour(event.target.value)}
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">:</span>
          <Input
            type="number"
            min="0"
            max="59"
            value={scheduleMinute}
            onChange={(event) => setScheduleMinute(event.target.value)}
            className="w-20"
          />
        </div>
      ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap justify-end gap-2 pt-6">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => void submit("draft")}
        >
          Save draft
        </Button>
        {composerTab === "schedule" ? (
          <Button type="button" disabled={isSubmitting} onClick={() => void submit("schedule")}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Schedule post
          </Button>
        ) : (
          <Button type="button" disabled={isSubmitting} onClick={() => void submit("publish")}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Publish now
          </Button>
        )}
      </div>
    </div>
  )
}
