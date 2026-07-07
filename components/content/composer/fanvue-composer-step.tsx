"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon, Loader2 } from "lucide-react"
import { toast } from "sonner"

import type { FanvueConnectionItem, FanvueMediaItem } from "@/components/content/types"
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
  onBack: () => void
  onSuccess: () => void
  onGoToMediaTab: () => void
}

export function FanvueComposerStep({ connection, onBack, onSuccess, onGoToMediaTab }: FanvueComposerStepProps) {
  const [caption, setCaption] = React.useState("")
  const [audience, setAudience] = React.useState<"subscribers" | "followers-and-subscribers">("subscribers")
  const [selectedMedia, setSelectedMedia] = React.useState<FanvueMediaItem | null>(null)
  const [previewMedia, setPreviewMedia] = React.useState<FanvueMediaItem | null>(null)
  const [isPaid, setIsPaid] = React.useState(false)
  const [priceDollars, setPriceDollars] = React.useState("5")
  const [composerTab, setComposerTab] = React.useState<"now" | "schedule">("now")
  const [scheduleDate, setScheduleDate] = React.useState<Date>(() => new Date(Date.now() + 60 * 60 * 1000))
  const [scheduleHour, setScheduleHour] = React.useState(String(new Date(Date.now() + 60 * 60 * 1000).getHours()))
  const [scheduleMinute, setScheduleMinute] = React.useState(
    String(new Date(Date.now() + 60 * 60 * 1000).getMinutes())
  )
  const [isSubmitting, setIsSubmitting] = React.useState(false)

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
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">Create Fanvue post</h3>
          <p className="text-sm text-muted-foreground">
            Posting to {connection.displayName || connection.username || "your Fanvue account"}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={onBack}>
          Change account
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-base font-semibold">Vault media</Label>
          <Button type="button" variant="link" className="h-auto px-0" onClick={onGoToMediaTab}>
            Upload in Media tab
          </Button>
        </div>
        <VaultMediaPicker
          connectionId={connection.id}
          selectedMediaUuid={selectedMedia?.uuid ?? null}
          previewMediaUuid={previewMedia?.uuid ?? null}
          onSelectMedia={setSelectedMedia}
        />
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

      <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
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
