"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  VoiceSelector,
  VoiceSelectorAttributes,
  VoiceSelectorBullet,
  VoiceSelectorContent,
  VoiceSelectorDescription,
  VoiceSelectorEmpty,
  VoiceSelectorGroup,
  VoiceSelectorInput,
  VoiceSelectorItem,
  VoiceSelectorList,
  VoiceSelectorName,
  VoiceSelectorPreview,
  VoiceSelectorSeparator,
  VoiceSelectorTrigger,
} from "@/components/ai-elements/voice-selector"
import {
  buildFallbackGoogleGeminiVoices,
  formatAudioLangCode,
  getAudioProviderLabel,
  getAudioVoiceSearchText,
  getAudioVoiceSourceLabel,
  getDefaultAudioVoiceId,
  getDefaultAudioVoiceName,
  type AudioProvider,
  type AudioVoice,
} from "@/lib/constants/audio"
import { cn } from "@/lib/utils"

interface AudioVoiceSelectorProps {
  provider: AudioProvider
  value: string
  onValueChange: (voiceId: string) => void
  onSelectedVoiceChange?: (voice: AudioVoice | null) => void
  disabled?: boolean
  className?: string
  triggerClassName?: string
  placeholder?: string
  renderTrigger?: (args: {
    selectedVoice: AudioVoice | null
    triggerLabel: string
    triggerId: string
    isLoading: boolean
    disabled: boolean
  }) => React.ReactNode
}

function groupVoicesBySource(voices: AudioVoice[]) {
  const sourceOrder = ["SYSTEM", "IVC", "PVC"]
  const groups = new Map<string, AudioVoice[]>()

  for (const voice of voices) {
    const source = voice.source || "SYSTEM"
    const bucket = groups.get(source)

    if (bucket) {
      bucket.push(voice)
    } else {
      groups.set(source, [voice])
    }
  }

  return Array.from(groups.entries()).sort(([a], [b]) => {
    const indexA = sourceOrder.indexOf(a)
    const indexB = sourceOrder.indexOf(b)

    if (indexA === -1 && indexB === -1) {
      return a.localeCompare(b)
    }

    if (indexA === -1) return 1
    if (indexB === -1) return -1

    return indexA - indexB
  })
}

export function AudioVoiceSelector({
  provider,
  value,
  onValueChange,
  onSelectedVoiceChange,
  disabled = false,
  className,
  triggerClassName,
  placeholder = "Search voices...",
  renderTrigger,
}: AudioVoiceSelectorProps) {
  const [voices, setVoices] = React.useState<AudioVoice[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [previewingVoiceId, setPreviewingVoiceId] = React.useState<string | null>(
    null
  )
  const [loadingPreviewVoiceId, setLoadingPreviewVoiceId] = React.useState<
    string | null
  >(null)
  const onValueChangeRef = React.useRef(onValueChange)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  React.useEffect(() => {
    onValueChangeRef.current = onValueChange
  }, [onValueChange])

  React.useEffect(() => {
    const controller = new AbortController()
    const fallbackGoogleVoices =
      provider === "google" ? buildFallbackGoogleGeminiVoices() : []

    function syncSelectedVoice(nextVoices: AudioVoice[]) {
      const hasCurrentValue = nextVoices.some((voice) => voice.voiceId === value)
      if (!hasCurrentValue) {
        const defaultVoice =
          nextVoices.find(
            (voice) => voice.voiceId === getDefaultAudioVoiceId(provider)
          ) ?? nextVoices[0]

        if (defaultVoice) {
          onValueChangeRef.current(defaultVoice.voiceId)
        }
      }
    }

    async function loadVoices() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/voices?provider=${provider}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const contentType = response.headers.get("content-type") ?? ""

        if (!contentType.includes("application/json")) {
          throw new Error("Voice catalog returned HTML instead of JSON")
        }

        const data = (await response.json()) as {
          voices?: AudioVoice[]
          error?: string
          message?: string
        }

        if (!response.ok) {
          throw new Error(data.error || data.message || "Failed to load voices")
        }

        const nextVoices =
          Array.isArray(data.voices) && data.voices.length > 0
            ? data.voices
            : fallbackGoogleVoices
        setVoices(nextVoices)
        syncSelectedVoice(nextVoices)
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return
        }

        if (provider === "google" && fallbackGoogleVoices.length > 0) {
          console.warn("Falling back to built-in Gemini voices.", fetchError)
          setVoices(fallbackGoogleVoices)
          syncSelectedVoice(fallbackGoogleVoices)
          return
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load voices"
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadVoices()

    return () => controller.abort()
  }, [provider, value])

  const filteredVoices = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return voices
    }
    return voices.filter((voice) =>
      getAudioVoiceSearchText(voice).includes(normalizedQuery)
    )
  }, [query, voices])

  const groupedVoices = React.useMemo(
    () => groupVoicesBySource(filteredVoices),
    [filteredVoices]
  )

  const selectedVoice = React.useMemo(
    () => voices.find((voice) => voice.voiceId === value) ?? null,
    [value, voices]
  )

  React.useEffect(() => {
    onSelectedVoiceChange?.(selectedVoice)
  }, [onSelectedVoiceChange, selectedVoice])

  const stopPreview = React.useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }

    setPreviewingVoiceId(null)
    setLoadingPreviewVoiceId(null)
  }, [])

  React.useEffect(() => {
    return () => {
      stopPreview()
    }
  }, [stopPreview])

  const handlePreviewToggle = React.useCallback(
    async (voice: AudioVoice) => {
      if (!voice.previewAudioUrl) {
        return
      }

      if (previewingVoiceId === voice.voiceId && audioRef.current) {
        stopPreview()
        return
      }

      stopPreview()
      setLoadingPreviewVoiceId(voice.voiceId)

      try {
        const audio = new Audio(voice.previewAudioUrl)
        audioRef.current = audio

        audio.addEventListener("ended", () => {
          if (audioRef.current === audio) {
            audioRef.current = null
            setPreviewingVoiceId(null)
            setLoadingPreviewVoiceId(null)
          }
        })

        audio.addEventListener("error", () => {
          if (audioRef.current === audio) {
            audioRef.current = null
            setPreviewingVoiceId(null)
            setLoadingPreviewVoiceId(null)
          }
        })

        await audio.play()
        setPreviewingVoiceId(voice.voiceId)
        setLoadingPreviewVoiceId(null)
      } catch (playbackError) {
        console.error("Failed to play voice preview:", playbackError)
        stopPreview()
      }
    },
    [previewingVoiceId, stopPreview]
  )

  const triggerLabel =
    selectedVoice?.displayName || getDefaultAudioVoiceName(provider)
  const triggerId =
    selectedVoice?.voiceId || value || getDefaultAudioVoiceId(provider)

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <VoiceSelector
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) {
            setQuery("")
            stopPreview()
          }
        }}
        onValueChange={(nextVoiceId) => {
          if (nextVoiceId) {
            onValueChange(nextVoiceId)
            setQuery("")
          }
        }}
        open={open}
        value={value}
      >
        <VoiceSelectorTrigger asChild>
          {renderTrigger ? (
            <div className="flex h-full min-h-0 w-full flex-1 flex-col outline-none">
              {renderTrigger({
                selectedVoice,
                triggerLabel,
                triggerId,
                isLoading,
                disabled: disabled || isLoading,
              })}
            </div>
          ) : (
            <Button
              className={cn(
                "h-8 w-full justify-between gap-2 rounded-lg border-white/10 bg-zinc-800/80 px-2.5 text-left text-xs hover:bg-zinc-900",
                triggerClassName
              )}
              disabled={disabled || isLoading}
              title={!isLoading ? triggerId : undefined}
              variant="outline"
            >
              <span className="min-w-0 flex-1 truncate text-zinc-100">
                {isLoading ? "Loading voices..." : triggerLabel}
              </span>
            </Button>
          )}
        </VoiceSelectorTrigger>
        <VoiceSelectorContent
          title={`Select ${getAudioProviderLabel(provider)} voice`}
        >
          <VoiceSelectorInput
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            value={query}
          />
          <VoiceSelectorList>
            {error ? (
              <VoiceSelectorEmpty>{error}</VoiceSelectorEmpty>
            ) : groupedVoices.length === 0 ? (
              <VoiceSelectorEmpty>
                {isLoading ? "Loading voices..." : "No voices found."}
              </VoiceSelectorEmpty>
            ) : (
              groupedVoices.map(([source, sourceVoices], groupIndex) => (
                <React.Fragment key={source}>
                  {groupIndex > 0 ? <VoiceSelectorSeparator /> : null}
                  <VoiceSelectorGroup>
                    <div className="px-3 pb-1 pt-2 text-xs text-zinc-500">
                      {getAudioVoiceSourceLabel(source)}
                    </div>
                    {sourceVoices.map((voice) => (
                      <VoiceSelectorItem
                        key={`${voice.provider ?? provider}:${voice.voiceId}`}
                        onSelect={() => onValueChange(voice.voiceId)}
                        value={voice.voiceId}
                      >
                        <VoiceSelectorPreview
                          aria-label={`Preview ${voice.displayName}`}
                          className={
                            !voice.previewAudioUrl
                              ? "cursor-not-allowed opacity-40"
                              : undefined
                          }
                          disabled={!voice.previewAudioUrl}
                          loading={loadingPreviewVoiceId === voice.voiceId}
                          onPlay={() => {
                            void handlePreviewToggle(voice)
                          }}
                          playing={previewingVoiceId === voice.voiceId}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <VoiceSelectorName className="truncate">
                              {voice.displayName}
                            </VoiceSelectorName>
                            {voice.langCode ? (
                              <Badge
                                className="h-4 px-1.5 text-[10px]"
                                variant="outline"
                              >
                                {formatAudioLangCode(voice.langCode)}
                              </Badge>
                            ) : null}
                          </div>
                          <VoiceSelectorAttributes className="mt-0.5">
                            <span className="truncate">{voice.voiceId}</span>
                            {voice.description ? <VoiceSelectorBullet /> : null}
                            {voice.description ? (
                              <VoiceSelectorDescription className="truncate">
                                {voice.description}
                              </VoiceSelectorDescription>
                            ) : null}
                          </VoiceSelectorAttributes>
                        </div>
                      </VoiceSelectorItem>
                    ))}
                  </VoiceSelectorGroup>
                </React.Fragment>
              ))
            )}
          </VoiceSelectorList>
        </VoiceSelectorContent>
      </VoiceSelector>
    </div>
  )
}
