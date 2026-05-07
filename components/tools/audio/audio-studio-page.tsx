"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  CircleNotch,
  Microphone,
  MusicNotesSimple,
  Pause,
  Play,
  Sparkle,
  VideoCamera,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { AudioModelOptionLabel } from "@/components/audio/audio-model-option-label"
import { AudioVoiceSelector } from "@/components/audio/voice-selector"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import {
  AUDIO_MODEL_OPTIONS,
  DEFAULT_AUDIO_PROVIDER,
  DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE,
  DEFAULT_GOOGLE_GEMINI_STYLE_PROMPT,
  getAudioModelLabel,
  getAudioProviderLabel,
  getDefaultAudioModel,
  getAudioProviderForModel,
  getDefaultAudioVoiceId,
  type AudioProvider,
  type AudioVoice,
} from "@/lib/constants/audio"
import { cn } from "@/lib/utils"

type AudioMode = "voiceover" | "change-voice"

type AudioHistoryItem = {
  id: string
  url: string
  prompt: string | null
  model: string | null
  createdAt: string | null
}

type VideoHistoryItem = {
  id: string
  url: string
  prompt: string | null
  model: string | null
  createdAt: string | null
}

type ReferenceVideo = {
  file: File
  url: string
}

type GenerationRecord = {
  id?: string
  url?: string | null
  prompt?: string | null
  model?: string | null
  created_at?: string | null
}

const AUDIO_LIMIT = 8
const LIPSYNC_LIMIT = 6
const EQ_BARS = [28, 14, 34, 18, 42, 24, 16, 30, 22, 38, 20, 12, 26, 32, 18, 40]
const GOOGLE_TAGS_HELPER =
  "Gemini supports inline tags like [laughing], [whispering], [shouting], and pause tags."

function formatTimestamp(value: string | null) {
  if (!value) return "Just now"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Just now"

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function normalizeAudioHistory(rows: GenerationRecord[]): AudioHistoryItem[] {
  return rows.reduce<AudioHistoryItem[]>((items, row) => {
    if (typeof row.id !== "string" || typeof row.url !== "string" || row.url.length === 0) {
      return items
    }

    items.push({
      id: row.id,
      url: row.url,
      prompt: row.prompt ?? null,
      model: row.model ?? null,
      createdAt: row.created_at ?? null,
    })

    return items
  }, [])
}

function normalizeVideoHistory(rows: GenerationRecord[]): VideoHistoryItem[] {
  return rows.reduce<VideoHistoryItem[]>((items, row) => {
    if (typeof row.id !== "string" || typeof row.url !== "string" || row.url.length === 0) {
      return items
    }

    items.push({
      id: row.id,
      url: row.url,
      prompt: row.prompt ?? null,
      model: row.model ?? null,
      createdAt: row.created_at ?? null,
    })

    return items
  }, [])
}

function mergeUniqueById<T extends { id: string }>(current: T[], incoming: T[]) {
  const seen = new Set<string>()

  return [...incoming, ...current].filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function buildLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function ModeSelector({
  mode,
  onChange,
}: {
  mode: AudioMode
  onChange: (mode: AudioMode) => void
}) {
  const options: Array<{
    key: AudioMode
    label: string
    icon: typeof Microphone
  }> = [
    { key: "voiceover", label: "Voiceover", icon: Microphone },
    { key: "change-voice", label: "Change Voice", icon: MusicNotesSimple },
  ]

  return (
    <div className="inline-flex rounded-[22px] border border-border/60 bg-card/70 p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="flex items-center gap-1.5">
        {options.map((option) => {
          const Icon = option.icon
          const active = option.key === mode

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-[16px] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.08em] transition-colors",
                active
                  ? "bg-background/80 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_26px_rgba(0,0,0,0.18)]"
                  : "text-muted-foreground hover:bg-background/35 hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  active
                    ? "bg-primary shadow-[0_0_12px_color-mix(in_oklch,var(--primary)_70%,transparent)]"
                    : "bg-border/80"
                )}
              />
              <Icon
                size={15}
                weight={active ? "fill" : "regular"}
                className={cn(active ? "text-primary" : "text-muted-foreground")}
              />
              <span className="truncate">{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ReferenceVideoChip({
  value,
  onChange,
  disabled,
}: {
  value: ReferenceVideo | null
  onChange: (video: ReferenceVideo | null) => void
  disabled?: boolean
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,.mp4,.mov,.webm,.m4v"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file) return
          if (!file.type.startsWith("video/")) {
            toast.error("Please upload a video file for Change Voice.")
            return
          }
          onChange({ file, url: URL.createObjectURL(file) })
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="relative w-full overflow-hidden rounded-[20px] border border-border/60 bg-[linear-gradient(180deg,color-mix(in_oklch,var(--card)_92%,transparent),color-mix(in_oklch,var(--muted)_38%,transparent))] px-3 py-2.5 text-left shadow-[0_20px_45px_rgba(0,0,0,0.28)] transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Reference Video
            </p>
            <p className="mt-1 truncate font-display text-xl font-bold uppercase tracking-tight text-primary">
              {value ? "Video loaded" : "Upload Video"}
            </p>
            <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
              {value?.file?.name ?? "Click to upload a talking-head clip"}
            </p>
          </div>
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background text-foreground">
            <VideoCamera size={15} weight="fill" />
          </span>
        </div>
        {value ? (
          <span
            onClick={(event) => {
              event.stopPropagation()
              onChange(null)
            }}
            className="absolute right-2 top-2 inline-flex size-5 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X size={10} />
          </span>
        ) : null}
      </button>
    </>
  )
}

function DockPromptPanel({
  mode,
  script,
  onScriptChange,
  provider,
  stylePrompt,
  onStylePromptChange,
  languageCode,
  onLanguageCodeChange,
  onEnhance,
  isEnhancing,
  isGenerating,
  error,
  statusMessage,
  modelId,
  onModelChange,
  referenceVideo,
  onReferenceVideoChange,
  embedInDock = false,
}: {
  mode: AudioMode
  script: string
  onScriptChange: (value: string) => void
  provider: AudioProvider
  stylePrompt: string
  onStylePromptChange: (value: string) => void
  languageCode: string
  onLanguageCodeChange: (value: string) => void
  onEnhance: () => void
  isEnhancing: boolean
  isGenerating: boolean
  error: string | null
  statusMessage: string | null
  modelId: string
  onModelChange: (value: string) => void
  referenceVideo: ReferenceVideo | null
  onReferenceVideoChange: (video: ReferenceVideo | null) => void
  embedInDock?: boolean
}) {
  const [showGeminiAdvancedControls, setShowGeminiAdvancedControls] = React.useState(false)
  const basePlaceholder =
    mode === "voiceover"
      ? "Write the line you want to synthesize..."
      : "Write the replacement line for your clip..."
  const scriptPlaceholder =
    provider === "google" ? `${basePlaceholder} ${GOOGLE_TAGS_HELPER}` : basePlaceholder

  const body = (
    <div className="space-y-3">
        <textarea
          value={script}
          onChange={(event) => onScriptChange(event.target.value)}
          placeholder={scriptPlaceholder}
          className="min-h-16 w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          rows={3}
        />

        {provider === "google" ? (
          <div className="space-y-2">
            {showGeminiAdvancedControls ? (
              <div className="grid gap-3 lg:grid-cols-[160px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Language
                  </p>
                  <Input
                    value={languageCode}
                    onChange={(event) => onLanguageCodeChange(event.target.value)}
                    placeholder={DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE}
                    className="h-9 border-border/60 bg-background/50 text-xs text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Style Prompt
                  </p>
                  <textarea
                    value={stylePrompt}
                    onChange={(event) => onStylePromptChange(event.target.value)}
                    placeholder={DEFAULT_GOOGLE_GEMINI_STYLE_PROMPT}
                    className="min-h-20 w-full resize-none rounded-[14px] border border-border/60 bg-background/50 px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground"
                    rows={3}
                  />
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Using default Gemini settings. Enhance can auto-fill language and style.
              </p>
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <Select value={modelId} onValueChange={onModelChange}>
            <SelectTrigger className="h-8 w-fit max-w-[min(100%,240px)] rounded-[14px] border-border/60 bg-background/50 px-3 text-xs text-foreground">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Current</SelectLabel>
                {AUDIO_MODEL_OPTIONS.filter((option) => option.group === "Current").map(
                  (option) => (
                    <SelectItem key={option.id} value={option.id}>
                      <AudioModelOptionLabel modelId={option.id}>
                        {option.label}
                      </AudioModelOptionLabel>
                    </SelectItem>
                  )
                )}
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Legacy</SelectLabel>
                {AUDIO_MODEL_OPTIONS.filter((option) => option.group === "Legacy").map(
                  (option) => (
                    <SelectItem key={option.id} value={option.id}>
                      <AudioModelOptionLabel modelId={option.id}>
                        {option.label}
                      </AudioModelOptionLabel>
                    </SelectItem>
                  )
                )}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEnhance}
            disabled={isEnhancing || isGenerating || script.trim().length === 0}
            className="h-8 rounded-[14px] border-border/60 bg-background/50 text-foreground hover:bg-accent/40 hover:text-foreground"
          >
            {isEnhancing ? (
              <CircleNotch className="mr-2 size-3.5 animate-spin" />
            ) : (
              <Sparkle className="mr-2 size-3.5" />
            )}
            Enhance
          </Button>

          {provider === "google" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowGeminiAdvancedControls((value) => !value)}
              className="h-8 rounded-[14px] px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:bg-accent/30 hover:text-foreground"
            >
              {showGeminiAdvancedControls ? "Hide advanced" : "Advanced controls"}
            </Button>
          ) : null}

          <span className={cn("ml-auto", error ? "text-destructive" : "text-muted-foreground")}>
            {error ?? statusMessage ?? `${script.trim().length} chars`}
          </span>
        </div>
    </div>
  )

  if (embedInDock) {
    return body
  }

  return (
    <div className="rounded-[18px] border border-border/60 bg-background/25 px-4 py-3">
      {body}
    </div>
  )
}

function VoicePresetCard({
  provider,
  voice,
  voiceId,
  previewing,
  onPreviewToggle,
  compact = false,
  showPreviewButton = true,
  minimalist = false,
  fillHeight = false,
}: {
  provider: AudioProvider
  voice: AudioVoice | null
  voiceId: string
  previewing: boolean
  onPreviewToggle: () => void
  compact?: boolean
  showPreviewButton?: boolean
  minimalist?: boolean
  fillHeight?: boolean
}) {
  const name = voice?.displayName || voiceId || getDefaultAudioVoiceId(provider)
  const subtitle =
    voice?.description ||
    `Select a ${getAudioProviderLabel(provider)} voice preset for playback`

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-border/60 bg-[linear-gradient(180deg,color-mix(in_oklch,var(--card)_92%,transparent),color-mix(in_oklch,var(--muted)_38%,transparent))] shadow-[0_20px_45px_rgba(0,0,0,0.28)]",
        fillHeight && "flex h-full min-h-0 flex-col",
        compact ? "rounded-[20px] px-3 py-2.5" : "rounded-[24px] px-4 py-3"
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3",
          fillHeight && "min-h-0 flex-1"
        )}
      >
        <div className="min-w-0">
          {!minimalist && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Voice Preset
            </p>
          )}
          <p
            className={cn(
              "truncate font-display font-bold uppercase tracking-tight text-primary",
              minimalist ? "text-lg" : compact ? "text-xl" : "text-2xl",
              !minimalist && "mt-1"
            )}
          >
            {name}
          </p>
          {!minimalist && (
            <p
              className={cn(
                "mt-1 text-[11px] text-muted-foreground",
                compact ? "line-clamp-1" : "line-clamp-2"
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
        {showPreviewButton ? (
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onPreviewToggle()
            }}
            disabled={!voice?.previewAudioUrl}
            aria-label={previewing ? "Pause voice preview" : "Play voice preview"}
            title={previewing ? "Pause voice preview" : "Play voice preview"}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full border border-border/60 bg-background text-foreground transition-colors enabled:hover:bg-primary enabled:hover:text-primary-foreground disabled:cursor-not-allowed disabled:bg-background/50 disabled:text-muted-foreground",
              compact ? "size-8" : "size-9"
            )}
          >
            {previewing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
          </button>
        ) : null}
      </div>
      <div
        className={cn(
          "flex items-end gap-1",
          fillHeight ? "mt-auto" : minimalist ? "mt-2" : compact ? "mt-3" : "mt-4"
        )}
      >
        {EQ_BARS.map((height, index) => (
          <span
            key={`${height}-${index}`}
            className="audio-eq-bar w-1 rounded-full bg-primary/70"
            style={{
              height: minimalist ? Math.max(4, Math.round(height * 0.35)) : compact ? Math.max(8, Math.round(height * 0.55)) : height,
              animationDelay: `${index * 70}ms`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function AudioResultCard({ item }: { item: AudioHistoryItem }) {
  return (
    <article className="rounded-[28px] border border-border/60 bg-card/70 p-4 shadow-[0_16px_38px_rgba(0,0,0,0.22)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Voiceover
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {getAudioModelLabel(item.model) ?? item.model ?? "Text to Speech"}
          </p>
        </div>
        <span className="text-[11px] text-muted-foreground">{formatTimestamp(item.createdAt)}</span>
      </div>
      <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
        {item.prompt || "Generated voice line"}
      </p>
      <audio src={item.url} controls className="mt-4 w-full" preload="metadata" />
    </article>
  )
}

function VideoResultCard({ item }: { item: VideoHistoryItem }) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-border/60 bg-card/70 shadow-[0_16px_38px_rgba(0,0,0,0.22)] backdrop-blur-sm">
      <video
        src={item.url}
        controls
        className="aspect-video w-full bg-background/60 object-contain"
        preload="metadata"
      />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Change Voice
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {item.model ?? "Lip Sync"}
            </p>
          </div>
          <span className="text-[11px] text-muted-foreground">{formatTimestamp(item.createdAt)}</span>
        </div>
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
          {item.prompt || "Voice-swapped clip created from your reference video."}
        </p>
      </div>
    </article>
  )
}

export function AudioStudioPage() {
  const searchParams = useSearchParams()
  const initialMode = React.useMemo<AudioMode>(() => {
    const raw = searchParams.get("mode")
    return raw === "change-voice" ? "change-voice" : "voiceover"
  }, [searchParams])

  const [mode, setMode] = React.useState<AudioMode>(initialMode)
  const [script, setScript] = React.useState("")
  const [voiceId, setVoiceId] = React.useState(getDefaultAudioVoiceId(DEFAULT_AUDIO_PROVIDER))
  const [modelId, setModelId] = React.useState<string>(
    getDefaultAudioModel(DEFAULT_AUDIO_PROVIDER)
  )
  const [stylePrompt, setStylePrompt] = React.useState<string>(DEFAULT_GOOGLE_GEMINI_STYLE_PROMPT)
  const [languageCode, setLanguageCode] = React.useState<string>(
    DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE
  )
  const [selectedVoice, setSelectedVoice] = React.useState<AudioVoice | null>(null)
  const [referenceVideo, setReferenceVideo] = React.useState<ReferenceVideo | null>(null)
  const [audioHistory, setAudioHistory] = React.useState<AudioHistoryItem[]>([])
  const [changeVoiceHistory, setChangeVoiceHistory] = React.useState<VideoHistoryItem[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = React.useState(true)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isEnhancing, setIsEnhancing] = React.useState(false)
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isVoicePreviewPlaying, setIsVoicePreviewPlaying] = React.useState(false)

  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null)
  const provider = getAudioProviderForModel(modelId)
  const previousProviderRef = React.useRef<AudioProvider>(provider)

  React.useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  React.useEffect(() => {
    if (previousProviderRef.current === provider) {
      return
    }

    previousProviderRef.current = provider
    setVoiceId(getDefaultAudioVoiceId(provider))
    setSelectedVoice(null)
    if (provider === "inworld") {
      setStylePrompt("")
    } else {
      if (!languageCode.trim()) {
        setLanguageCode(DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE)
      }
      if (!stylePrompt.trim()) {
        setStylePrompt(DEFAULT_GOOGLE_GEMINI_STYLE_PROMPT)
      }
    }
  }, [languageCode, provider, stylePrompt])

  React.useEffect(() => {
    let cancelled = false

    async function fetchHistory() {
      setIsHistoryLoading(true)
      try {
        const [audioResponse, lipsyncResponse] = await Promise.all([
          fetch(`/api/generations?type=audio&limit=${AUDIO_LIMIT}`),
          fetch(`/api/generations?type=video&tool=lipsync&limit=${LIPSYNC_LIMIT}`),
        ])

        if (!cancelled && audioResponse.ok) {
          const data = (await audioResponse.json()) as { generations?: GenerationRecord[] }
          setAudioHistory(
            normalizeAudioHistory(Array.isArray(data.generations) ? data.generations : [])
          )
        }

        if (!cancelled && lipsyncResponse.ok) {
          const data = (await lipsyncResponse.json()) as { generations?: GenerationRecord[] }
          setChangeVoiceHistory(
            normalizeVideoHistory(Array.isArray(data.generations) ? data.generations : [])
          )
        }
      } catch (historyError) {
        console.error("Failed to fetch audio studio history", historyError)
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false)
        }
      }
    }

    void fetchHistory()

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current = null
      }
    }
  }, [])

  const handlePreviewToggle = React.useCallback(async () => {
    if (!selectedVoice?.previewAudioUrl) return

    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current.currentTime = 0
      previewAudioRef.current = null
      setIsVoicePreviewPlaying(false)
      return
    }

    try {
      const audio = new Audio(selectedVoice.previewAudioUrl)
      previewAudioRef.current = audio
      setIsVoicePreviewPlaying(true)
      audio.addEventListener("ended", () => {
        if (previewAudioRef.current === audio) {
          previewAudioRef.current = null
          setIsVoicePreviewPlaying(false)
        }
      })
      audio.addEventListener("error", () => {
        if (previewAudioRef.current === audio) {
          previewAudioRef.current = null
          setIsVoicePreviewPlaying(false)
        }
      })
      await audio.play()
    } catch (previewError) {
      console.error("Failed to preview voice", previewError)
      previewAudioRef.current = null
      setIsVoicePreviewPlaying(false)
    }
  }, [selectedVoice])

  const handleEnhance = React.useCallback(async () => {
    const trimmed = script.trim()
    if (!trimmed) {
      setError("Add your script before enhancing it.")
      return
    }

    setIsEnhancing(true)
    setError(null)

    try {
      const response = await fetch("/api/enhance-tts-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model: modelId,
          text: trimmed,
          voice: voiceId,
          stylePrompt,
          languageCode,
        }),
      })

      const data = (await response.json().catch(() => ({}))) as {
        text?: string
        languageCode?: string
        stylePrompt?: string
        error?: string
        message?: string
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || "Could not enhance this script")
      }

      if (!data.text?.trim()) {
        throw new Error("The enhancer returned empty text.")
      }

      setScript(data.text)
      if (provider === "google") {
        if (typeof data.languageCode === "string" && data.languageCode.trim().length > 0) {
          setLanguageCode(data.languageCode.trim())
        }
        if (typeof data.stylePrompt === "string" && data.stylePrompt.trim().length > 0) {
          setStylePrompt(data.stylePrompt)
        }
        toast.success("Script and style optimized for Gemini TTS")
      } else {
        toast.success("Script optimized for Inworld TTS")
      }
    } catch (enhanceError) {
      const message =
        enhanceError instanceof Error ? enhanceError.message : "Could not enhance this script"
      setError(message)
      toast.error(message)
    } finally {
      setIsEnhancing(false)
    }
  }, [languageCode, modelId, provider, script, stylePrompt, voiceId])

  const handleGenerate = React.useCallback(async () => {
    const trimmedScript = script.trim()
    if (!trimmedScript) {
      setError(
        mode === "voiceover"
          ? "Write a script to generate audio."
          : "Write a script to create the replacement voice."
      )
      return
    }

    if (!voiceId.trim()) {
      setError("Choose a voice preset first.")
      return
    }

    if (mode === "change-voice" && !referenceVideo?.file) {
      setError("Upload a reference video to change the voice.")
      return
    }

    setIsGenerating(true)
    setStatusMessage(
      mode === "voiceover" ? "Generating voiceover..." : "Generating replacement voice..."
    )
    setError(null)

    try {
      const audioResponse = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          text: trimmedScript,
          voice: voiceId,
          model: modelId,
          stylePrompt: provider === "google" ? stylePrompt : undefined,
          languageCode: provider === "google" ? languageCode : undefined,
        }),
      })

      const audioData = (await audioResponse.json().catch(() => ({}))) as {
        audio?: { url?: string }
        error?: string
        message?: string
      }

      if (!audioResponse.ok) {
        throw new Error(audioData.error || audioData.message || "Failed to generate audio")
      }

      const generatedAudioUrl = audioData.audio?.url
      if (!generatedAudioUrl) {
        throw new Error("No generated audio URL was returned.")
      }

      if (mode === "voiceover") {
        const nextItem: AudioHistoryItem = {
          id: buildLocalId("audio"),
          url: generatedAudioUrl,
          prompt: trimmedScript,
          model: modelId,
          createdAt: new Date().toISOString(),
        }
        setAudioHistory((current) => mergeUniqueById(current, [nextItem]))
        setStatusMessage(null)
        toast.success("Voiceover generated")
        return
      }

      setStatusMessage("Uploading reference video...")
      const uploadedVideo = await uploadFileToSupabase(
        referenceVideo!.file,
        "audio-change-voice-videos"
      )
      if (!uploadedVideo) {
        throw new Error("Failed to upload the reference video.")
      }

      setStatusMessage("Syncing the new voice to your video...")
      const lipsyncResponse = await fetch("/api/generate-lipsync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: uploadedVideo.url,
          videoStoragePath: uploadedVideo.storagePath,
          audioUrl: generatedAudioUrl,
        }),
      })

      const lipsyncData = (await lipsyncResponse.json().catch(() => ({}))) as {
        video?: { url?: string }
        error?: string
        message?: string
      }

      if (!lipsyncResponse.ok) {
        throw new Error(
          lipsyncData.error ||
            lipsyncData.message ||
            "Failed to create the voice-changed video"
        )
      }

      const generatedVideoUrl = lipsyncData.video?.url
      if (!generatedVideoUrl) {
        throw new Error("No generated video URL was returned.")
      }

      const nextVideo: VideoHistoryItem = {
        id: buildLocalId("change-voice"),
        url: generatedVideoUrl,
        prompt: trimmedScript,
        model: "pixverse/lipsync",
        createdAt: new Date().toISOString(),
      }
      setChangeVoiceHistory((current) => mergeUniqueById(current, [nextVideo]))
      setStatusMessage(null)
      toast.success("Voice change video generated")
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : "Generation failed"
      setError(message)
      toast.error(message)
    } finally {
      setIsGenerating(false)
      setStatusMessage(null)
    }
  }, [languageCode, mode, modelId, provider, referenceVideo, script, stylePrompt, voiceId])

  const canGenerate =
    script.trim().length > 0 &&
    voiceId.trim().length > 0 &&
    (mode === "voiceover" || Boolean(referenceVideo?.file))

  const heroTitle =
    mode === "voiceover"
      ? "Ready to give your scene a voice?"
      : "Ready to swap the voice in your clip?"

  const heroEyebrow = mode === "voiceover" ? "Audio" : "Change Voice"
  const results = mode === "voiceover" ? audioHistory : changeVoiceHistory
  const hasResults = results.length > 0

  const renderDockPromptPanel = () => (
    <DockPromptPanel
      mode={mode}
      script={script}
      onScriptChange={(value) => {
        setScript(value)
        if (error) setError(null)
      }}
      provider={provider}
      stylePrompt={stylePrompt}
      onStylePromptChange={(value) => {
        setStylePrompt(value)
        if (error) setError(null)
      }}
      languageCode={languageCode}
      onLanguageCodeChange={(value) => {
        setLanguageCode(value)
        if (error) setError(null)
      }}
      onEnhance={handleEnhance}
      isEnhancing={isEnhancing}
      isGenerating={isGenerating}
      error={error}
      statusMessage={statusMessage}
      modelId={modelId}
      onModelChange={(value) => {
        setModelId(value)
        if (error) setError(null)
      }}
      referenceVideo={referenceVideo}
      onReferenceVideoChange={(video) => {
        setReferenceVideo(video)
        if (error) setError(null)
      }}
      embedInDock
    />
  )

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-[linear-gradient(180deg,color-mix(in_oklch,var(--background)_0%,transparent),color-mix(in_oklch,var(--background)_88%,transparent)_55%,var(--background))]" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-72 items-end justify-between gap-2 px-4 md:px-8">
        {Array.from({ length: 40 }).map((_, index) => {
          const height = 36 + ((index * 19) % 150)
          return (
            <span
              key={index}
              className="audio-eq-bar w-3 rounded-t-[10px] bg-primary/12 opacity-35"
              style={{
                height,
                animationDelay: `${index * 90}ms`,
              }}
            />
          )
        })}
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 pb-44 pt-24 sm:px-6 md:pb-40 lg:px-10">
        {!hasResults && !isHistoryLoading ? (
          <section className="relative z-10 mt-8 flex flex-1 flex-col items-center text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              {heroEyebrow}
            </p>
            <div className="mt-4 max-w-4xl">
              <h1 className="bg-gradient-to-r from-chart-1 via-chart-3 to-primary bg-clip-text font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight text-transparent sm:text-6xl lg:text-7xl">
                {heroTitle}
              </h1>
            </div>
            <p className="mt-5 max-w-2xl text-sm text-muted-foreground sm:text-base">
              {mode === "voiceover"
                ? "Write the line, choose Inworld or Gemini TTS, and generate polished narration that fits the rest of the UniCan workflow."
                : "Create a new spoken line with Inworld or Gemini TTS, then push it through your existing lip-sync video model to revoice a talking-head clip."}
            </p>
          </section>
        ) : (
          <section className="relative z-10 mt-8 flex-1">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {mode === "voiceover" ? "Recent voiceovers" : "Recent voice changes"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mode === "voiceover"
                    ? "Generated audio stays playable here while the cinematic layout remains intact."
                    : "Recent lip-sync generations created from the Change Voice flow."}
                </p>
              </div>
            </div>

            {error ? (
              <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {isHistoryLoading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: mode === "voiceover" ? 3 : 2 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-48 animate-pulse rounded-[28px] border border-border/50 bg-card/60"
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {mode === "voiceover"
                  ? (results as AudioHistoryItem[]).map((item) => (
                      <AudioResultCard key={item.id} item={item} />
                    ))
                  : (results as VideoHistoryItem[]).map((item) => (
                      <VideoResultCard key={item.id} item={item} />
                    ))}
              </div>
            )}
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:px-6 md:px-8 md:pb-6">
        <div className="mx-auto max-w-[1180px]">
          <div className="rounded-[28px] border border-border/60 bg-[linear-gradient(180deg,color-mix(in_oklch,var(--card)_96%,transparent),color-mix(in_oklch,var(--muted)_62%,transparent))] p-3 shadow-[0_28px_90px_rgba(0,0,0,0.42),0_14px_44px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl">
            <div className="flex flex-col gap-3">
              <div className="flex justify-start">
                <ModeSelector mode={mode} onChange={setMode} />
              </div>

              {mode === "change-voice" ? (
                <div className="hidden md:block">
                  <ReferenceVideoChip
                    value={referenceVideo}
                    onChange={(video) => {
                      setReferenceVideo(video)
                      if (error) setError(null)
                    }}
                    disabled={isGenerating}
                  />
                </div>
              ) : null}

              <div className="hidden md:grid md:min-h-[112px] md:grid-cols-[minmax(0,1fr)_min(240px,26vw)_160px] md:gap-3 md:items-stretch">
                <div className="h-full min-h-0 min-w-0 overflow-y-auto rounded-[24px] border border-border/60 bg-background/30 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  {renderDockPromptPanel()}
                </div>
                <div className="flex h-full min-h-0 min-w-0 flex-col">
                  <AudioVoiceSelector
                    provider={provider}
                    className="flex h-full min-h-0 flex-1 flex-col gap-0"
                    value={voiceId}
                    onSelectedVoiceChange={setSelectedVoice}
                    onValueChange={(nextVoiceId) => {
                      setVoiceId(nextVoiceId)
                      if (error) setError(null)
                    }}
                    renderTrigger={({ disabled }) => (
                      <div
                        aria-disabled={disabled}
                        className={cn(
                          "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col text-left",
                          disabled ? "cursor-not-allowed opacity-70" : undefined
                        )}
                      >
                        <VoicePresetCard
                          provider={provider}
                          voice={selectedVoice}
                          voiceId={voiceId}
                          previewing={isVoicePreviewPlaying}
                          onPreviewToggle={() => {
                            void handlePreviewToggle()
                          }}
                          compact
                          fillHeight
                        />
                      </div>
                    )}
                  />
                </div>
                <Button
                  onClick={() => {
                    void handleGenerate()
                  }}
                  disabled={!canGenerate || isGenerating || isEnhancing}
                  className="flex h-full min-h-[112px] shrink-0 flex-row items-center justify-center gap-2 self-stretch rounded-[22px] bg-primary px-4 py-4 font-display text-lg font-bold uppercase tracking-[0.08em] text-primary-foreground shadow-lg transition-transform hover:-translate-y-px hover:bg-primary/90 disabled:translate-y-0 disabled:bg-primary/55 disabled:text-primary-foreground/60"
                >
                  {isGenerating ? (
                    <>
                      <CircleNotch className="size-5 animate-spin" />
                      {mode === "voiceover" ? "Generating" : "Processing"}
                    </>
                  ) : (
                    <>
                      Generate
                      <Sparkle className="size-5" weight="fill" />
                    </>
                  )}
                </Button>
              </div>

              <div className="flex flex-col gap-3 md:hidden">
                {mode === "change-voice" ? (
                  <ReferenceVideoChip
                    value={referenceVideo}
                    onChange={(video) => {
                      setReferenceVideo(video)
                      if (error) setError(null)
                    }}
                    disabled={isGenerating}
                  />
                ) : null}
                <div className="rounded-[24px] border border-border/60 bg-background/30 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  {renderDockPromptPanel()}
                </div>
                <div className="flex items-stretch gap-2">
                  <div className="flex min-h-[104px] min-w-0 flex-1 basis-0 flex-col">
                    <AudioVoiceSelector
                      provider={provider}
                      className="flex h-full min-h-0 flex-1 flex-col gap-0"
                      value={voiceId}
                      onSelectedVoiceChange={setSelectedVoice}
                      onValueChange={(nextVoiceId) => {
                        setVoiceId(nextVoiceId)
                        if (error) setError(null)
                      }}
                      renderTrigger={({ disabled }) => (
                        <div
                          aria-disabled={disabled}
                          className={cn(
                            "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col text-left",
                            disabled ? "cursor-not-allowed opacity-70" : undefined
                          )}
                        >
                          <VoicePresetCard
                            provider={provider}
                            voice={selectedVoice}
                            voiceId={voiceId}
                            previewing={isVoicePreviewPlaying}
                            onPreviewToggle={() => {
                              void handlePreviewToggle()
                            }}
                            compact
                            minimalist
                            fillHeight
                          />
                        </div>
                      )}
                    />
                  </div>
                  <Button
                    onClick={() => {
                      void handleGenerate()
                    }}
                    disabled={!canGenerate || isGenerating || isEnhancing}
                    className="flex h-full min-h-[104px] min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 self-stretch rounded-[20px] bg-primary px-2 py-3 font-display text-xs font-bold uppercase tracking-[0.08em] text-primary-foreground shadow-lg transition-transform hover:-translate-y-px hover:bg-primary/90 disabled:translate-y-0 disabled:bg-primary/55 disabled:text-primary-foreground/60 sm:text-sm"
                  >
                    {isGenerating ? (
                      <>
                        <CircleNotch className="size-4 shrink-0 animate-spin" />
                        <span className="text-center leading-tight">
                          {mode === "voiceover" ? "Generating" : "Processing"}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>Generate</span>
                        <Sparkle className="size-4 shrink-0" weight="fill" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
