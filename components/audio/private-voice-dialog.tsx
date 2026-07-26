"use client"

import * as React from "react"
import {
  CircleNotch,
  Info,
  LockSimple,
  Microphone,
  Sparkle,
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
  DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE,
  DEFAULT_GOOGLE_GEMINI_STYLE_PROMPT,
  DEFAULT_GOOGLE_GEMINI_VOICE_ID,
  DEFAULT_QWEN3_LANGUAGE,
  GOOGLE_GEMINI_TTS_VOICES,
  MAX_PRIVATE_VOICE_REFERENCE_SECONDS,
  QWEN3_TTS_LANGUAGES,
  type AudioProvider,
  type AudioVoice,
} from "@/lib/constants/audio"
import { getAudioDurationSeconds } from "@/lib/video-editor/media-parser"

export function PrivateVoiceDialog({
  open,
  onOpenChange,
  provider,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: AudioProvider
  onCreated: (voice: AudioVoice) => void
}) {
  const [name, setName] = React.useState("")
  const [kind, setKind] = React.useState<"clone" | "design">("clone")
  const [language, setLanguage] = React.useState<string>(DEFAULT_QWEN3_LANGUAGE)
  const [referenceAudio, setReferenceAudio] = React.useState<File | null>(null)
  const [referenceAudioUrl, setReferenceAudioUrl] = React.useState("")
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
  const [isSaving, setIsSaving] = React.useState(false)

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

  const canSave =
    name.trim().length >= 2 &&
    (provider === "google" ||
      (kind === "clone" ? Boolean(referenceAudio) : voiceDescription.trim().length > 0))
  const saveLabel =
    provider === "google"
      ? "Save Gemini voice"
      : kind === "clone"
        ? "Save cloned voice"
        : "Save designed voice"

  async function validateReferenceAudio(file: File | null) {
    setReferenceAudio(null)
    if (!file) return false

    try {
      const durationSeconds = await getAudioDurationSeconds(file)
      if (
        !Number.isFinite(durationSeconds) ||
        durationSeconds <= 0 ||
        durationSeconds > MAX_PRIVATE_VOICE_REFERENCE_SECONDS
      ) {
        toast.error("Reference recordings must be 15 seconds or shorter")
        return false
      }

      setReferenceAudio(file)
      toast.success("Reference recording ready")
      return true
    } catch {
      toast.error("Could not read the recording. Try WAV, MP3, M4A, OGG, or WebM.")
      return false
    }
  }

  async function saveVoice() {
    if (!canSave) return
    setIsSaving(true)
    try {
      const body = new FormData()
      body.set("provider", provider)
      body.set("kind", provider === "google" ? "design" : kind)
      body.set("name", name.trim())

      if (provider === "google") {
        body.set("baseVoice", baseVoice)
        body.set("languageCode", languageCode)
        body.set("stylePrompt", stylePrompt.trim())
      } else {
        body.set("language", language)
        body.set("voiceDescription", voiceDescription.trim())
        body.set("styleInstruction", styleInstruction.trim())
        if (referenceAudio) {
          body.set("referenceAudio", referenceAudio)

          // Qwen can clone without a transcript, but a silent automatic transcript
          // improves fidelity when speech-to-text is available.
          const transcriptForm = new FormData()
          transcriptForm.set("audio", referenceAudio)
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
      }

      const response = await fetch("/api/voices", { method: "POST", body })
      const data = (await response.json().catch(() => ({}))) as {
        voice?: AudioVoice
        error?: string
        message?: string
      }
      if (!response.ok || !data.voice) {
        throw new Error(data.message || data.error || "Could not save this voice")
      }

      onCreated(data.voice)
      onOpenChange(false)
      setName("")
      setReferenceAudio(null)
      setVoiceDescription("")
      setStyleInstruction("")
      toast.success("Private voice saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this voice")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <TooltipProvider>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-lg overflow-y-auto rounded-[28px] border border-border/60 bg-card p-6 shadow-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold uppercase tracking-tight">
            {provider === "google" ? "Save Gemini Voice" : "Create Private Voice"}
          </DialogTitle>
          <DialogDescription>
            {provider === "google"
              ? "Save a reusable Gemini base voice, language, and delivery design."
              : "Clone from a short recording or design a new voice from words."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {provider === "qwen" ? (
            <>
              <Tabs value={kind} onValueChange={(value) => setKind(value as "clone" | "design")}>
                <TabsList
                  variant="default"
                  className="grid h-auto min-h-10 w-full grid-cols-2 gap-0.5 rounded-4xl border border-border/65 bg-muted/95 p-0.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.10),inset_0_1px_2px_rgba(0,0,0,0.06),inset_0_-1px_1px_rgba(255,255,255,0.35)] dark:border-border/45 dark:bg-muted/55 dark:shadow-[inset_0_2px_12px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(0,0,0,0.45),inset_0_-1px_0_rgba(255,255,255,0.04)]"
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
                  <label className="text-xs font-medium text-foreground" htmlFor="private-voice-name">
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
                    <SelectTrigger aria-label="Voice language"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {QWEN3_TTS_LANGUAGES.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
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
                  <p className="text-[11px] text-muted-foreground">
                    {referenceAudio
                      ? `${referenceAudio.name} is ready. No transcript upload needed.`
                      : "Upload a file or use the mic. No transcript upload needed."}
                  </p>
                  {referenceAudioUrl ? (
                    <audio
                      src={referenceAudioUrl}
                      controls
                      preload="metadata"
                      className="h-9 w-full"
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
                  Create a reusable Gemini voice profile
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Choose a Gemini base voice, then save your language and delivery
                  direction together. This is a designed profile, not a cloned voice.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground" htmlFor="gemini-voice-name">
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
                <SelectTrigger aria-label="Gemini base voice"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOOGLE_GEMINI_TTS_VOICES.map((voice) => (
                    <SelectItem key={voice.voiceId} value={voice.voiceId}>
                      {voice.voiceId} · {voice.character}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground" htmlFor="gemini-language-code">
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

        <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <LockSimple className="mt-0.5 size-4 shrink-0" />
          <p>
            {provider === "google"
              ? "Only you can access this saved voice profile."
              : "Only you can access this voice. Your reference recording stays private and is used only when you generate with it."}
          </p>
        </div>

        <Button onClick={() => void saveVoice()} disabled={!canSave || isSaving}>
          {isSaving ? <CircleNotch className="mr-2 size-4 animate-spin" /> : null}
          {saveLabel}
        </Button>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  )
}
