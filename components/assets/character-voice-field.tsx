"use client"

import * as React from "react"
import {
  CircleNotch,
  Microphone,
  PauseIcon,
  PencilSimple,
  PlayIcon,
  Plus,
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
  placeholder,
  triggerClassName,
  onPick,
  onCreate,
}: {
  voices: AudioVoice[]
  value?: string
  disabled?: boolean
  isLoading?: boolean
  isOverlay?: boolean
  placeholder: string
  triggerClassName?: string
  onPick: (voice: AudioVoice) => void
  onCreate: () => void
}) {
  const grouped = React.useMemo(
    () => groupAttachableCharacterVoices(voices),
    [voices],
  )

  return (
    <Select
      value={value}
      disabled={disabled || isLoading}
      onValueChange={(nextValue) => {
        if (nextValue === "__create__") {
          onCreate()
          return
        }
        const next = findVoiceBySelectValue(voices, nextValue)
        if (next) onPick(next)
      }}
    >
      <SelectTrigger
        className={cn(
          "h-8 text-xs",
          isOverlay &&
            "rounded-full border-white/15 bg-white/10 text-white hover:bg-white/15",
          triggerClassName,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
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
        <SelectItem value="__create__">Create new voice…</SelectItem>
      </SelectContent>
    </Select>
  )
}

type CharacterVoiceFieldProps = {
  value: CharacterVoiceValue
  onChange: (next: CharacterVoiceValue) => void
  disabled?: boolean
  appearance?: "form" | "overlay"
  onUseVoice?: () => void
  className?: string
}

export function CharacterVoiceField({
  value,
  onChange,
  disabled = false,
  appearance = "form",
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
              placeholder="Choose"
              triggerClassName="w-[8.5rem]"
              onPick={applyVoice}
              onCreate={openCreate}
            />
            <Button
              type="button"
              size="sm"
              variant={isOverlay ? "secondary" : "outline"}
              disabled={disabled}
              className={cn(
                "h-8 gap-1.5 rounded-full",
                isOverlay && "border-white/10 bg-white/15 text-white hover:bg-white/20",
              )}
              onClick={openCreate}
            >
              <Plus className="size-3.5" weight="bold" />
              Create
            </Button>
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
            placeholder="Change"
            triggerClassName="w-[7.5rem] shrink-0"
            onPick={applyVoice}
            onCreate={openCreate}
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
