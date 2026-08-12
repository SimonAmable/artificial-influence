"use client"

import * as React from "react"
import {
  CircleNotch,
  Microphone,
  PauseIcon,
  PencilSimple,
  PlayIcon,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { PrivateVoiceDialog } from "@/components/audio/private-voice-dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  characterVoiceDisplayName,
  characterVoiceFromAudioVoice,
  emptyCharacterVoice,
  fetchAttachableCharacterVoices,
  findVoiceBySelectValue,
  groupAttachableCharacterVoices,
  hasCharacterVoice,
  voiceSelectValue,
  type CharacterVoiceValue,
} from "@/lib/assets/character-voice-value"
import { type AudioProvider, type AudioVoice } from "@/lib/constants/audio"
import { cn } from "@/lib/utils"

export const overlayActionButtonClass =
  "size-12 shrink-0 rounded-full border border-white/55 bg-white text-neutral-950 shadow-lg hover:bg-neutral-100 focus-visible:border-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
export const overlayActionButtonMutedClass =
  "size-12 shrink-0 rounded-full border border-white/60 bg-neutral-950/80 text-white shadow-lg backdrop-blur-md hover:bg-neutral-950 focus-visible:border-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
export const overlayVoiceSelectTriggerClass =
  "h-12 min-w-[9.5rem] max-w-[12rem] shrink-0 gap-2 rounded-full border border-white/55 bg-white px-3.5 text-sm font-medium text-neutral-950 shadow-lg hover:bg-neutral-100 focus-visible:border-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 data-[state=open]:bg-neutral-100 [&_svg]:shrink-0 [&_svg:last-child]:text-neutral-700"

export type { CharacterVoiceValue }

function VoicePreviewButton({
  src,
  label,
  className,
}: {
  src: string
  label: string
  className?: string
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const stop = () => setIsPlaying(false)
    audio.addEventListener("ended", stop)
    audio.addEventListener("pause", stop)
    return () => {
      audio.removeEventListener("ended", stop)
      audio.removeEventListener("pause", stop)
      audio.pause()
    }
  }, [src])

  async function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.paused) {
      audio.pause()
      audio.currentTime = 0
      setIsPlaying(false)
      return
    }
    setIsLoading(true)
    try {
      await audio.play()
      setIsPlaying(true)
    } catch {
      toast.error("Could not play voice preview")
      setIsPlaying(false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn("size-8 shrink-0 rounded-full", className)}
        aria-label={isPlaying ? `Pause ${label}` : `Play ${label}`}
        onClick={() => void toggle()}
      >
        {isLoading ? (
          <CircleNotch className="size-3.5 animate-spin" />
        ) : isPlaying ? (
          <PauseIcon className="size-3.5" weight="fill" />
        ) : (
          <PlayIcon className="size-3.5" weight="fill" />
        )}
      </Button>
    </>
  )
}

function VoicePickerSelect({
  voices,
  value,
  disabled,
  isLoading,
  isOverlay,
  compact = false,
  showNoVoiceOption = false,
  compactLabel,
  placeholder,
  triggerClassName,
  onPick,
  onCreate,
  onClear,
}: {
  voices: AudioVoice[]
  value?: string
  disabled?: boolean
  isLoading?: boolean
  isOverlay?: boolean
  compact?: boolean
  showNoVoiceOption?: boolean
  compactLabel?: string
  placeholder: string
  triggerClassName?: string
  onPick: (voice: AudioVoice) => void
  onCreate: () => void
  onClear?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const grouped = React.useMemo(
    () => groupAttachableCharacterVoices(voices),
    [voices],
  )
  const resolvedValue = value ?? (showNoVoiceOption ? "__none__" : undefined)

  return (
    <Select
      open={open}
      onOpenChange={setOpen}
      value={resolvedValue}
      disabled={disabled}
      onValueChange={(nextValue) => {
        if (nextValue === "__create__") {
          setOpen(false)
          onCreate()
          return
        }
        if (nextValue === "__none__") {
          onClear?.()
          return
        }
        const next = findVoiceBySelectValue(voices, nextValue)
        if (next) onPick(next)
      }}
    >
      <SelectTrigger
        size="default"
        className={cn(
          compact
            ? cn(
                overlayVoiceSelectTriggerClass,
                resolvedValue &&
                  resolvedValue !== "__none__" &&
                  "border-primary/70 ring-1 ring-primary/35",
              )
            : "h-8 text-xs",
          !compact &&
            isOverlay &&
            "rounded-full border-white/15 bg-white/10 text-white hover:bg-white/15",
          triggerClassName,
        )}
        aria-label={
          compact
            ? `Character voice: ${compactLabel ?? placeholder}. Open menu to choose a voice.`
            : undefined
        }
      >
        {compact ? (
          <>
            {isLoading ? (
              <CircleNotch className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Microphone
                className="size-4"
                weight={
                  resolvedValue && resolvedValue !== "__none__" ? "fill" : "regular"
                }
                aria-hidden="true"
              />
            )}
            <span className="min-w-0 flex-1 truncate text-left">
              {compactLabel ?? placeholder}
            </span>
            <SelectValue className="sr-only" />
          </>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent
        position="popper"
        side={compact ? "top" : "bottom"}
        align={compact ? "start" : "center"}
        sideOffset={compact ? 10 : 4}
        className={cn("max-h-72", compact && "z-[500] min-w-[var(--radix-select-trigger-width)]")}
      >
        {showNoVoiceOption ? (
          <SelectGroup>
            <SelectItem value="__none__">No voice</SelectItem>
            <SelectItem value="__create__">Create new voice…</SelectItem>
          </SelectGroup>
        ) : (
          <SelectGroup>
            <SelectItem value="__create__">Create new voice…</SelectItem>
          </SelectGroup>
        )}
        {grouped.privateVoices.length > 0 ? (
          <SelectGroup>
            <SelectLabel>My voices</SelectLabel>
            {grouped.privateVoices.map((voice) => (
              <SelectItem key={voiceSelectValue(voice)} value={voiceSelectValue(voice)}>
                {voice.displayName}
              </SelectItem>
            ))}
          </SelectGroup>
        ) : null}
        {grouped.catalogGroups.map((group) => (
          <SelectGroup key={group.provider}>
            <SelectLabel>{group.label} defaults</SelectLabel>
            {group.voices.map((voice) => (
              <SelectItem key={voiceSelectValue(voice)} value={voiceSelectValue(voice)}>
                {voice.displayName}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

type CharacterVoiceFieldProps = {
  value: CharacterVoiceValue
  onChange: (next: CharacterVoiceValue) => void
  disabled?: boolean
  appearance?: "form" | "overlay"
  layout?: "default" | "compact"
  onUseVoice?: () => void
  className?: string
}

export function CharacterVoiceField({
  value,
  onChange,
  disabled = false,
  appearance = "form",
  layout = "default",
  onUseVoice,
  className,
}: CharacterVoiceFieldProps) {
  const [voices, setVoices] = React.useState<AudioVoice[]>([])
  const [isLoadingVoices, setIsLoadingVoices] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingVoice, setEditingVoice] = React.useState<AudioVoice | null>(null)
  const [dialogProvider, setDialogProvider] = React.useState<AudioProvider>("qwen")

  const refreshVoices = React.useCallback(async () => {
    setIsLoadingVoices(true)
    try {
      const next = await fetchAttachableCharacterVoices()
      setVoices(next)
      return next
    } catch (error) {
      console.warn(error)
      toast.error("Failed to load voices")
      return [] as AudioVoice[]
    } finally {
      setIsLoadingVoices(false)
    }
  }, [])

  React.useEffect(() => {
    void refreshVoices()
  }, [refreshVoices])

  const selectedVoice =
    voices.find(
      (voice) =>
        voice.voiceId === value.voiceId &&
        (voice.provider ?? "") === (value.voiceProvider ?? ""),
    ) ??
    voices.find((voice) =>
      value.privateVoiceId
        ? voice.privateVoiceId === value.privateVoiceId
        : false,
    ) ??
    null

  const displayName =
    selectedVoice?.displayName || characterVoiceDisplayName(value)
  const previewUrl = selectedVoice?.previewAudioUrl || value.previewUrl || null
  const hasVoice = hasCharacterVoice(value)
  const isPrivate = Boolean(value.privateVoiceId)
  const selectedSelectValue = selectedVoice
    ? voiceSelectValue(selectedVoice)
    : value.voiceId && value.voiceProvider
      ? `${value.voiceProvider}::${value.voiceId}`
      : undefined

  const openCreate = () => {
    setEditingVoice(null)
    setDialogProvider("qwen")
    setDialogOpen(true)
  }

  const openEdit = () => {
    if (!isPrivate) {
      openCreate()
      return
    }
    const voice =
      selectedVoice ||
      ({
        voiceId: value.voiceId || `private:${value.privateVoiceId}`,
        displayName: displayName || "Private voice",
        description: "",
        langCode: "",
        tags: ["private"],
        source: "CLONE",
        provider: value.voiceProvider || "qwen",
        privateVoiceId: value.privateVoiceId!,
      } satisfies AudioVoice)
    setEditingVoice(voice)
    setDialogProvider(
      voice.provider === "google" || voice.provider === "qwen"
        ? voice.provider
        : "qwen",
    )
    setDialogOpen(true)
  }

  const applyVoice = (voice: AudioVoice) => {
    onChange(characterVoiceFromAudioVoice(voice))
  }

  const isOverlay = appearance === "overlay"
  const isCompact = layout === "compact"

  const clearVoice = () => onChange(emptyCharacterVoice())

  if (isCompact) {
    return (
      <>
        <div className={cn("relative z-20", className)}>
          <VoicePickerSelect
            voices={voices}
            value={hasVoice ? selectedSelectValue : "__none__"}
            disabled={disabled}
            isLoading={isLoadingVoices}
            isOverlay={isOverlay}
            compact
            showNoVoiceOption
            compactLabel={hasVoice ? displayName : "No voice"}
            placeholder={hasVoice ? displayName : "No voice"}
            onPick={applyVoice}
            onCreate={openCreate}
            onClear={clearVoice}
          />
        </div>
        {hasVoice && previewUrl ? (
          <VoicePreviewButton
            src={previewUrl}
            label={displayName}
            className={overlayActionButtonClass}
          />
        ) : null}
        {hasVoice && isPrivate ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={disabled}
            className={overlayActionButtonMutedClass}
            aria-label="Edit voice"
            onClick={openEdit}
          >
            <PencilSimple className="size-[18px]" />
          </Button>
        ) : null}

        <PrivateVoiceDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) setEditingVoice(null)
          }}
          provider={dialogProvider}
          voice={editingVoice}
          onCreated={(voice) => {
            applyVoice(voice)
            void refreshVoices()
            setDialogOpen(false)
            setEditingVoice(null)
          }}
          onUpdated={(voice) => {
            applyVoice(voice)
            void refreshVoices()
            setDialogOpen(false)
            setEditingVoice(null)
          }}
        />
      </>
    )
  }

  return (
    <div className={cn(className)}>
      {!hasVoice ? (
        <div
          className={cn(
            "flex items-center justify-between gap-3",
            isOverlay
              ? "rounded-full border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-md"
              : "rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5",
          )}
        >
          <div className="min-w-0 flex items-center gap-2">
            <Microphone
              className={cn(
                "size-4 shrink-0",
                isOverlay ? "text-white/80" : "text-muted-foreground",
              )}
            />
            <p
              className={cn(
                "truncate text-sm",
                isOverlay ? "text-white/85" : "text-muted-foreground",
              )}
            >
              No voice attached
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <VoicePickerSelect
              voices={voices}
              disabled={disabled}
              isLoading={isLoadingVoices}
              isOverlay={isOverlay}
              showNoVoiceOption
              placeholder="Choose"
              triggerClassName="w-[8.5rem]"
              onPick={applyVoice}
              onCreate={openCreate}
              onClear={clearVoice}
            />
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "flex items-center gap-2",
            isOverlay
              ? "rounded-full border border-white/10 bg-black/45 px-2.5 py-1.5 backdrop-blur-md"
              : "rounded-xl border border-border/70 bg-muted/30 px-2.5 py-2",
          )}
        >
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-sm font-medium",
                isOverlay ? "text-white" : "text-foreground",
              )}
            >
              {displayName}
            </p>
            {!isOverlay ? (
              <p className="text-[11px] text-muted-foreground">
                {isPrivate ? "Private voice" : "Default voice"}
              </p>
            ) : null}
          </div>
          {isOverlay && onUseVoice ? (
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              className="h-8 shrink-0 rounded-full border border-white/10 bg-white/15 px-3 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-white/20"
              onClick={onUseVoice}
            >
              Use voice
            </Button>
          ) : null}
          <VoicePickerSelect
            voices={voices}
            value={selectedSelectValue}
            disabled={disabled}
            isLoading={isLoadingVoices}
            isOverlay={isOverlay}
            showNoVoiceOption
            placeholder="Change"
            triggerClassName="w-[7.5rem] shrink-0"
            onPick={applyVoice}
            onCreate={openCreate}
            onClear={clearVoice}
          />
          {previewUrl ? (
            <VoicePreviewButton
              src={previewUrl}
              label={displayName}
              className={
                isOverlay
                  ? "border-transparent bg-transparent text-white hover:bg-white/10"
                  : undefined
              }
            />
          ) : null}
          {isPrivate ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={disabled}
              className={cn(
                "size-8 shrink-0 rounded-full",
                isOverlay && "text-white hover:bg-white/10 hover:text-white",
              )}
              aria-label="Edit voice"
              onClick={openEdit}
            >
              <PencilSimple className="size-3.5" />
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={disabled}
            className={cn(
              "size-8 shrink-0 rounded-full",
              isOverlay && "text-white hover:bg-white/10 hover:text-white",
            )}
            aria-label="Remove voice"
            onClick={() => onChange(emptyCharacterVoice())}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      <PrivateVoiceDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingVoice(null)
        }}
        provider={dialogProvider}
        voice={editingVoice}
        onCreated={(voice) => {
          applyVoice(voice)
          void refreshVoices()
          setDialogOpen(false)
          setEditingVoice(null)
        }}
        onUpdated={(voice) => {
          applyVoice(voice)
          void refreshVoices()
          setDialogOpen(false)
          setEditingVoice(null)
        }}
      />
    </div>
  )
}
