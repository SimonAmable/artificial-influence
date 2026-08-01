"use client"

import * as React from "react"
import {
  CircleNotch,
  Info,
  LockSimple,
  Microphone,
  PauseIcon,
  PlayIcon,
  Sparkle,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { SpeechInput } from "@/components/ai-elements/speech-input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AUDIO_MODEL_ADVICE,
  DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE,
  DEFAULT_GOOGLE_GEMINI_STYLE_PROMPT,
  DEFAULT_GOOGLE_GEMINI_VOICE_ID,
  DEFAULT_QWEN3_LANGUAGE,
  GOOGLE_GEMINI_TTS_MODEL,
  GOOGLE_GEMINI_TTS_VOICES,
  MAX_PRIVATE_VOICE_REFERENCE_SECONDS,
  PRIVATE_VOICE_PREVIEW_CREDIT_COST,
  PRIVATE_VOICE_PREVIEW_TEXT,
  QWEN3_TTS_LANGUAGES,
  QWEN3_TTS_MODEL,
  FISH_AUDIO_TTS_MODEL,
  getAudioModelLabel,
  type AudioProvider,
  type AudioVoice,
} from "@/lib/constants/audio"
import { cn } from "@/lib/utils"
import { getAudioDurationSeconds } from "@/lib/video-editor/media-parser"

function AudioPreviewPlayer({
  src,
  label,
  onClear,
  startSeconds = 0,
  endSeconds,
}: {
  src: string
  label: string
  onClear?: () => void
  startSeconds?: number
  endSeconds?: number
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleEnded = () => setIsPlaying(false)
    const handlePause = () => setIsPlaying(false)
    const handlePlay = () => setIsPlaying(true)
    const handleTimeUpdate = () => {
      if (endSeconds !== undefined && audio.currentTime >= endSeconds) {
        audio.pause()
        audio.currentTime = startSeconds
      }
    }

    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("timeupdate", handleTimeUpdate)
    return () => {
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.pause()
    }
  }, [endSeconds, src, startSeconds])

  async function togglePlayback() {
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
      if (audio.currentTime < startSeconds || (endSeconds !== undefined && audio.currentTime >= endSeconds)) {
        audio.currentTime = startSeconds
      }
      await audio.play()
      setIsPlaying(true)
    } catch {
      toast.error("Could not play this recording")
      setIsPlaying(false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-2.5 py-2">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-9 shrink-0 rounded-full"
        aria-label={isPlaying ? `Pause ${label}` : `Play ${label}`}
        onClick={() => void togglePlayback()}
      >
        {isLoading ? (
          <CircleNotch className="size-4 animate-spin" />
        ) : isPlaying ? (
          <PauseIcon className="size-4" weight="fill" />
        ) : (
          <PlayIcon className="size-4" weight="fill" />
        )}
      </Button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">
          {isPlaying ? "Playing sample…" : "Tap play to preview"}
        </p>
      </div>
      {onClear ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 shrink-0"
          aria-label="Remove recording"
          onClick={onClear}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}

function audioBufferToWav(audioBuffer: AudioBuffer) {
  const channels = audioBuffer.numberOfChannels
  const bytesPerSample = 2
  const blockAlign = channels * bytesPerSample
  const dataSize = audioBuffer.length * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index))
  }

  writeString(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, audioBuffer.sampleRate, true)
  view.setUint32(28, audioBuffer.sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(36, "data")
  view.setUint32(40, dataSize, true)

  const channelData = Array.from({ length: channels }, (_, index) => audioBuffer.getChannelData(index))
  let offset = 44
  for (let frame = 0; frame < audioBuffer.length; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame] ?? 0))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += bytesPerSample
    }
  }
  return buffer
}

export function PrivateVoiceDialog({
  open,
  onOpenChange,
  provider,
  voice = null,
  onCreated,
  onUpdated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: AudioProvider
  voice?: AudioVoice | null
  onCreated: (voice: AudioVoice) => void
  onUpdated?: (voice: AudioVoice) => void
}) {
  const [savedVoiceId, setSavedVoiceId] = React.useState<string | null>(
    voice?.privateVoiceId ?? null
  )
  const [name, setName] = React.useState("")
  const [kind, setKind] = React.useState<"clone" | "design">("clone")
  const [language, setLanguage] = React.useState<string>(DEFAULT_QWEN3_LANGUAGE)
  const [referenceAudio, setReferenceAudio] = React.useState<File | null>(null)
  const [referenceDuration, setReferenceDuration] = React.useState(0)
  const [referenceStartSeconds, setReferenceStartSeconds] = React.useState(0)
  const [referenceAudioUrl, setReferenceAudioUrl] = React.useState("")
  const [existingReferenceUrl, setExistingReferenceUrl] = React.useState("")
  const [generatedPreviewUrl, setGeneratedPreviewUrl] = React.useState("")
  const [voiceDescription, setVoiceDescription] = React.useState("")
  const [styleInstruction, setStyleInstruction] = React.useState("")
  const [baseVoice, setBaseVoice] = React.useState<string>(
    DEFAULT_GOOGLE_GEMINI_VOICE_ID
  )
  const [languageCode, setLanguageCode] = React.useState<string>(
    DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE
  )
  const [stylePrompt, setStylePrompt] = React.useState<string>(
    DEFAULT_GOOGLE_GEMINI_STYLE_PROMPT
  )
  const [baseVoicePreviewUrl, setBaseVoicePreviewUrl] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)
  const [isPreviewing, setIsPreviewing] = React.useState(false)

  const resetForm = React.useCallback(() => {
    setSavedVoiceId(null)
    setName("")
    setKind(provider === "google" ? "design" : "clone")
    setLanguage(DEFAULT_QWEN3_LANGUAGE)
    setReferenceAudio(null)
    setReferenceDuration(0)
    setReferenceStartSeconds(0)
    setReferenceAudioUrl("")
    setExistingReferenceUrl("")
    setGeneratedPreviewUrl("")
    setVoiceDescription("")
    setStyleInstruction("")
    setBaseVoice(DEFAULT_GOOGLE_GEMINI_VOICE_ID)
    setLanguageCode(DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE)
    setStylePrompt(DEFAULT_GOOGLE_GEMINI_STYLE_PROMPT)
    setBaseVoicePreviewUrl("")
  }, [provider])

  React.useEffect(() => {
    if (!open) return

    if (!voice?.privateVoiceId) {
      resetForm()
      return
    }

    const config = voice.privateVoiceConfig ?? {}
    setSavedVoiceId(voice.privateVoiceId)
    setName(voice.displayName)
    setKind(voice.privateVoiceKind ?? "design")
    setLanguage(config.language ?? DEFAULT_QWEN3_LANGUAGE)
    setReferenceAudio(null)
    setReferenceDuration(0)
    setReferenceStartSeconds(0)
    setReferenceAudioUrl("")
    setExistingReferenceUrl(voice.referenceAudioUrl ?? "")
    setGeneratedPreviewUrl(
      voice.previewAudioUrl && voice.previewAudioUrl !== voice.referenceAudioUrl
        ? voice.previewAudioUrl
        : ""
    )
    setVoiceDescription(config.voiceDescription ?? "")
    setStyleInstruction(config.styleInstruction ?? "")
    setBaseVoice(config.baseVoice ?? DEFAULT_GOOGLE_GEMINI_VOICE_ID)
    setLanguageCode(config.languageCode ?? DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE)
    setStylePrompt(config.stylePrompt ?? DEFAULT_GOOGLE_GEMINI_STYLE_PROMPT)
  }, [open, resetForm, voice])

  React.useEffect(() => {
    if (provider === "google") setKind("design")
  }, [provider])

  React.useEffect(() => {
    if (!referenceAudio) {
      setReferenceAudioUrl("")
      return
    }

    const objectUrl = URL.createObjectURL(referenceAudio)
    setReferenceAudioUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [referenceAudio])

  React.useEffect(() => {
    if (!open || provider !== "google") {
      setBaseVoicePreviewUrl("")
      return
    }

    const controller = new AbortController()

    async function loadBaseVoicePreview() {
      try {
        const response = await fetch(`/api/voices?provider=google`, {
          cache: "no-store",
          signal: controller.signal,
        })
        if (!response.ok) return
        const data = (await response.json().catch(() => ({}))) as {
          voices?: AudioVoice[]
        }
        const match = (data.voices ?? []).find(
          (entry) => entry.voiceId === baseVoice && entry.previewAudioUrl
        )
        setBaseVoicePreviewUrl(match?.previewAudioUrl ?? "")
      } catch {
        if (!controller.signal.aborted) {
          setBaseVoicePreviewUrl("")
        }
      }
    }

    void loadBaseVoicePreview()
    return () => controller.abort()
  }, [baseVoice, open, provider])

  const activeReferenceUrl = referenceAudioUrl || existingReferenceUrl
  const selectedReferenceDuration = referenceDuration
    ? Math.min(MAX_PRIVATE_VOICE_REFERENCE_SECONDS, referenceDuration - referenceStartSeconds)
    : 0
  const selectedReferenceEndSeconds = referenceStartSeconds + selectedReferenceDuration
  const hasSavedVoice = Boolean(savedVoiceId || voice?.privateVoiceId)
  const canSave =
    name.trim().length >= 2 &&
    (provider === "google" ||
      (kind === "clone"
        ? Boolean(referenceAudio || (hasSavedVoice && existingReferenceUrl))
        : voiceDescription.trim().length > 0))
  const saveLabel = hasSavedVoice
    ? "Save changes"
    : provider === "google"
      ? "Save Gemini voice"
      : kind === "clone"
        ? "Save cloned voice"
        : "Save designed voice"
  const isBusy = isSaving || isPreviewing

  async function validateReferenceAudio(file: File | null) {
    setReferenceAudio(null)
    setReferenceDuration(0)
    setReferenceStartSeconds(0)
    if (!file) return false

    try {
      const durationSeconds = await getAudioDurationSeconds(file)
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        toast.error("Could not read a usable duration from the recording")
        return false
      }

      setReferenceAudio(file)
      setReferenceDuration(durationSeconds)
      toast.success(
        durationSeconds > MAX_PRIVATE_VOICE_REFERENCE_SECONDS
          ? "Choose the best 15-second section to use for cloning"
          : "Reference recording ready"
      )
      return true
    } catch {
      toast.error("Could not read the recording. Try WAV, MP3, M4A, OGG, or WebM.")
      return false
    }
  }

  async function createReferenceClip(file: File) {
    if (referenceDuration <= MAX_PRIVATE_VOICE_REFERENCE_SECONDS) return file

    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) throw new Error("This browser cannot trim audio. Please use a 15-second recording.")
    const context = new AudioContextClass()
    try {
      const decoded = await context.decodeAudioData((await file.arrayBuffer()).slice(0))
      const startFrame = Math.floor(referenceStartSeconds * decoded.sampleRate)
      const frameCount = Math.min(
        Math.floor(MAX_PRIVATE_VOICE_REFERENCE_SECONDS * decoded.sampleRate),
        decoded.length - startFrame
      )
      const clip = context.createBuffer(decoded.numberOfChannels, frameCount, decoded.sampleRate)
      for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
        clip.copyToChannel(decoded.getChannelData(channel).slice(startFrame, startFrame + frameCount), channel)
      }
      return new File([audioBufferToWav(clip)], `${file.name.replace(/\.[^.]+$/, "")}-clip.wav`, {
        type: "audio/wav",
      })
    } finally {
      await context.close()
    }
  }

  async function buildVoiceFormData() {
    const body = new FormData()
    body.set("provider", provider)
    body.set("kind", provider === "google" ? "design" : kind)
    body.set("name", name.trim())
    if (savedVoiceId) {
      body.set("voiceId", savedVoiceId)
    }

    if (provider === "google") {
      body.set("baseVoice", baseVoice)
      body.set("languageCode", languageCode)
      body.set("stylePrompt", stylePrompt.trim())
      return body
    }

    body.set("language", language)
    body.set("voiceDescription", voiceDescription.trim())
    body.set("styleInstruction", styleInstruction.trim())
    if (referenceAudio) {
      const referenceClip = await createReferenceClip(referenceAudio)
      body.set("referenceAudio", referenceClip)

      const transcriptForm = new FormData()
      transcriptForm.set("audio", referenceClip)
      const transcriptResponse = await fetch("/api/transcribe", {
        method: "POST",
        body: transcriptForm,
      })
      if (transcriptResponse.ok) {
        const transcript = (await transcriptResponse.json().catch(() => ({}))) as {
          text?: string
        }
        if (transcript.text?.trim()) {
          body.set("referenceText", transcript.text.trim())
        }
      }
    }
    return body
  }

  function applySavedVoice(nextVoice: AudioVoice, { created }: { created: boolean }) {
    setSavedVoiceId(nextVoice.privateVoiceId ?? null)
    if (nextVoice.referenceAudioUrl) {
      setExistingReferenceUrl(nextVoice.referenceAudioUrl)
    }
    if (nextVoice.previewAudioUrl) {
      setGeneratedPreviewUrl(nextVoice.previewAudioUrl)
    }
    setReferenceAudio(null)
    if (created) onCreated(nextVoice)
    else onUpdated?.(nextVoice)
  }

  async function saveVoice() {
    if (!canSave) return
    setIsSaving(true)
    try {
      const body = await buildVoiceFormData()
      // Creating a Fish clone also creates its provider-side persistent model, which
      // happens in the preview endpoint before we expose it as a saved voice.
      const endpoint = !savedVoiceId && provider === "fish"
        ? "/api/voices/preview"
        : savedVoiceId
          ? `/api/voices/${savedVoiceId}`
          : "/api/voices"
      const response = await fetch(endpoint, {
        method: savedVoiceId ? "PATCH" : "POST",
        body,
      })
      const data = (await response.json().catch(() => ({}))) as {
        voice?: AudioVoice
        error?: string
        message?: string
      }
      if (!response.ok || !data.voice) {
        throw new Error(data.message || data.error || "Could not save this voice")
      }

      applySavedVoice(data.voice, { created: !savedVoiceId })
      toast.success(savedVoiceId ? "Private voice updated" : "Private voice saved")
      onOpenChange(false)
      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this voice")
    } finally {
      setIsSaving(false)
    }
  }

  async function previewVoice() {
    if (!canSave) return
    setIsPreviewing(true)
    try {
      const body = await buildVoiceFormData()
      const response = await fetch("/api/voices/preview", {
        method: "POST",
        body,
      })
      const data = (await response.json().catch(() => ({}))) as {
        voice?: AudioVoice
        previewAudioUrl?: string
        created?: boolean
        error?: string
        message?: string
      }
      if (!response.ok || !data.voice) {
        throw new Error(data.message || data.error || "Could not preview this voice")
      }

      applySavedVoice(data.voice, { created: Boolean(data.created) })
      if (data.previewAudioUrl) {
        setGeneratedPreviewUrl(data.previewAudioUrl)
      }
      toast.success("Voice saved — preview is ready to play")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not preview this voice")
    } finally {
      setIsPreviewing(false)
    }
  }

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-lg overflow-y-auto rounded-[28px] border border-border/60 bg-card p-6 shadow-lg">
          <DialogHeader>
            <div className="flex items-start gap-2">
              <DialogTitle className="min-w-0 flex-1 font-display text-xl font-bold uppercase tracking-tight">
                {hasSavedVoice
                  ? provider === "google"
                    ? "Edit Gemini Voice"
                    : "Edit Private Voice"
                  : provider === "google"
                    ? "Save Gemini Voice"
                    : "Create Private Voice"}
              </DialogTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${getAudioModelLabel(
                      provider === "google" ? GOOGLE_GEMINI_TTS_MODEL : provider === "fish" ? FISH_AUDIO_TTS_MODEL : QWEN3_TTS_MODEL
                    )} prompting advice`}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
                  >
                    <Info className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-80 text-pretty leading-relaxed">
                  {AUDIO_MODEL_ADVICE[provider === "google" ? "google" : provider === "fish" ? "fish" : "qwen"]}
                </TooltipContent>
              </Tooltip>
            </div>
            <DialogDescription>
              {hasSavedVoice
                ? "Update settings, then preview to hear and save a playable sample."
                : provider === "google"
                  ? "Configure a Gemini profile, then preview to save it with a playable sample."
                  : "Clone or design a voice, then preview to save it with a playable sample."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {provider === "qwen" || provider === "fish" ? (
              <>
                <Tabs
                  value={kind}
                  onValueChange={(value) => {
                    if (hasSavedVoice) return
                    setKind(provider === "fish" ? "clone" : value as "clone" | "design")
                  }}
                >
                  <TabsList
                    variant="default"
                    className={cn(
                      "grid h-auto min-h-10 w-full grid-cols-2 gap-0.5 rounded-4xl border border-border/65 bg-muted/95 p-0.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.10),inset_0_1px_2px_rgba(0,0,0,0.06),inset_0_-1px_1px_rgba(255,255,255,0.35)] dark:border-border/45 dark:bg-muted/55 dark:shadow-[inset_0_2px_12px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(0,0,0,0.45),inset_0_-1px_0_rgba(255,255,255,0.04)]",
                      hasSavedVoice && "pointer-events-none opacity-70"
                    )}
                  >
                    <TabsTrigger
                      value="clone"
                      className="min-h-8 w-full rounded-2xl px-3 py-1.5 text-xs"
                    >
                      <Microphone className="size-4" />
                      Clone
                    </TabsTrigger>
                    <TabsTrigger
                      value="design"
                      className="min-h-8 w-full rounded-2xl px-3 py-1.5 text-xs"
                    >
                      <Sparkle className="size-4" />
                      Design
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="rounded-2xl border border-border/60 bg-muted/45 p-3">
                  <p className="text-sm font-medium text-foreground">
                    {kind === "clone" ? "Clone your own voice" : "Design a voice from words"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {kind === "clone"
                      ? "Record or upload one clear, single-speaker sample. 5–15 seconds works best, and we create the reference transcript automatically."
                      : "Describe the voice identity—such as age, accent, tone, and character. You can set its usual delivery separately."}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(kind === "clone"
                      ? ["5–15 seconds", "One speaker", "No music or echo"]
                      : ["Voice identity", "Accent", "Tone & character"]
                    ).map((tip) => (
                      <span
                        key={tip}
                        className="rounded-full border border-border/60 bg-background/70 px-2 py-1 text-[11px] text-muted-foreground"
                      >
                        {tip}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-medium text-foreground"
                      htmlFor="private-voice-name"
                    >
                      Voice name
                    </label>
                    <Input
                      id="private-voice-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g. My narrator"
                      maxLength={80}
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <span className="text-xs font-medium text-foreground">Language</span>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger aria-label="Voice language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QWEN3_TTS_LANGUAGES.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {kind === "clone" ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <label
                        className="text-xs font-medium text-foreground"
                        htmlFor="private-voice-recording"
                      >
                        Reference recording
                      </label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="Qwen reference recording advice"
                            className="text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Info className="size-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-72 text-pretty leading-relaxed">
                          Qwen clones timbre and prosody from the sample. Use 5–15 seconds
                          of clean speech from one speaker, with no music, echo, or long
                          silence. We create the matching transcript automatically.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id="private-voice-recording"
                        type="file"
                        accept="audio/*,.wav,.mp3,.m4a,.ogg,.opus,.flac"
                        className="min-w-0 flex-1"
                        onChange={(event) => {
                          void validateReferenceAudio(event.target.files?.[0] ?? null)
                        }}
                      />
                      <SpeechInput
                        aria-label="Record reference voice"
                        title="Record reference voice"
                        variant="outline"
                        size="icon"
                        className="size-10 shrink-0"
                        forceServerTranscription
                        maxDurationSeconds={MAX_PRIVATE_VOICE_REFERENCE_SECONDS}
                        onAudioRecorded={async (audioBlob) => {
                          await validateReferenceAudio(
                            new File([audioBlob], `voice-sample-${Date.now()}.webm`, {
                              type: audioBlob.type || "audio/webm",
                            })
                          )
                          return ""
                        }}
                        onTranscriptionError={() => {
                          toast.error("Could not capture the recording")
                        }}
                      />
                    </div>
                    {referenceAudio && referenceDuration > MAX_PRIVATE_VOICE_REFERENCE_SECONDS ? (
                      <div className="rounded-xl border border-border/60 bg-muted/35 p-3">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-medium text-foreground">Clone section</span>
                          <span className="text-muted-foreground">
                            {referenceStartSeconds.toFixed(1)}s to {selectedReferenceEndSeconds.toFixed(1)}s (15s)
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, referenceDuration - MAX_PRIVATE_VOICE_REFERENCE_SECONDS)}
                          step={0.1}
                          value={referenceStartSeconds}
                          onChange={(event) => setReferenceStartSeconds(Number(event.target.value))}
                          className="mt-3 w-full accent-primary"
                          aria-label="Start of 15-second clone section"
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Drag to choose the 15 seconds sent to voice cloning. Preview plays only this section.
                        </p>
                      </div>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground">
                      {activeReferenceUrl
                        ? referenceAudio
                          ? `${referenceAudio.name} is ready. Preview the cloned voice below.`
                          : "Current sample is saved. Preview the cloned voice below, or replace the recording."
                        : "Upload a file or use the mic, then preview the cloned voice."}
                    </p>
                    {activeReferenceUrl ? (
                      <AudioPreviewPlayer
                        src={activeReferenceUrl}
                        label={
                          referenceAudio?.name ||
                          (hasSavedVoice ? "Saved reference sample" : "Reference sample")
                        }
                        startSeconds={referenceAudio ? referenceStartSeconds : 0}
                        endSeconds={referenceAudio ? selectedReferenceEndSeconds || undefined : undefined}
                        onClear={
                          referenceAudio
                              ? () => {
                                  setReferenceAudio(null)
                                  setReferenceDuration(0)
                                  setReferenceStartSeconds(0)
                                }
                            : undefined
                        }
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <label
                        className="text-xs font-medium text-foreground"
                        htmlFor="private-voice-description"
                      >
                        Voice description
                      </label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="Qwen voice design advice"
                            className="text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Info className="size-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-72 text-pretty leading-relaxed">
                          For Qwen Voice Design, describe stable identity traits: age
                          range, pitch, timbre, accent, vocal texture, and persona. Put
                          temporary emotion or pacing in Default delivery.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <textarea
                      id="private-voice-description"
                      value={voiceDescription}
                      onChange={(event) => setVoiceDescription(event.target.value)}
                      placeholder="A warm documentary narrator with a subtle Canadian accent..."
                      rows={4}
                      className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-medium text-foreground"
                    htmlFor="private-voice-delivery"
                  >
                    Default delivery{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    id="private-voice-delivery"
                    value={styleInstruction}
                    onChange={(event) => setStyleInstruction(event.target.value)}
                    placeholder="Calm, intimate, measured pace..."
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-border/60 bg-muted/45 p-3">
                  <p className="text-sm font-medium text-foreground">
                    {hasSavedVoice
                      ? "Update this Gemini voice profile"
                      : "Create a reusable Gemini voice profile"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Choose a Gemini base voice, then preview to save the profile and hear
                    a playable sample in this modal.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    className="text-xs font-medium text-foreground"
                    htmlFor="gemini-voice-name"
                  >
                    Profile name
                  </label>
                  <Input
                    id="gemini-voice-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Bright product host"
                    maxLength={80}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-foreground">Base voice</span>
                  <Select value={baseVoice} onValueChange={setBaseVoice}>
                    <SelectTrigger aria-label="Gemini base voice">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GOOGLE_GEMINI_TTS_VOICES.map((entry) => (
                        <SelectItem key={entry.voiceId} value={entry.voiceId}>
                          {entry.voiceId} · {entry.character}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {baseVoicePreviewUrl ? (
                    <AudioPreviewPlayer
                      src={baseVoicePreviewUrl}
                      label={`${baseVoice} preview`}
                    />
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Preview audio appears here when a sample is available for this base
                      voice.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-medium text-foreground"
                    htmlFor="gemini-language-code"
                  >
                    Language code
                  </label>
                  <Input
                    id="gemini-language-code"
                    value={languageCode}
                    onChange={(event) => setLanguageCode(event.target.value)}
                    placeholder="e.g. en-US"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <label
                      className="text-xs font-medium text-foreground"
                      htmlFor="gemini-voice-style"
                    >
                      Voice & delivery direction
                    </label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Gemini voice design advice"
                          className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Info className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-72 text-pretty leading-relaxed">
                        Gemini works best with an audio profile, a short scene, and
                        director notes for tone, accent, pace, breathing, and
                        articulation. Keep the direction consistent with the script.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <textarea
                    id="gemini-voice-style"
                    value={stylePrompt}
                    onChange={(event) => setStylePrompt(event.target.value)}
                    placeholder="Describe the voice and delivery..."
                    rows={5}
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
                  />
                </div>
              </>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/35 p-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Voice preview</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Preview saves this voice and generates a playable sample saying “
                {PRIVATE_VOICE_PREVIEW_TEXT}” ({PRIVATE_VOICE_PREVIEW_CREDIT_COST} credit).
              </p>
            </div>
            {generatedPreviewUrl ? (
              <AudioPreviewPlayer
                src={generatedPreviewUrl}
                label="Generated voice preview"
              />
            ) : (
              <p className="text-[11px] text-muted-foreground">
                No generated preview yet. Tap Preview voice to create one.
              </p>
            )}
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => void previewVoice()}
              disabled={!canSave || isBusy}
            >
              {isPreviewing ? <CircleNotch className="mr-2 size-4 animate-spin" /> : (
                <PlayIcon className="mr-2 size-4" weight="fill" />
              )}
              {isPreviewing ? "Generating preview…" : "Preview voice"}
            </Button>
          </div>

          <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <LockSimple className="mt-0.5 size-4 shrink-0" />
            <p>
              {provider === "google"
                ? "Only you can access this saved voice profile."
                : "Only you can access this voice. Your reference recording stays private and is used only when you generate with it."}
            </p>
          </div>

          <Button onClick={() => void saveVoice()} disabled={!canSave || isBusy}>
            {isSaving ? <CircleNotch className="mr-2 size-4 animate-spin" /> : null}
            {saveLabel}
          </Button>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
