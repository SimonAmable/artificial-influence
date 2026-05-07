"use client"

import * as React from "react"
import { CircleNotch, Sparkle } from "@phosphor-icons/react"

import { AudioModelOptionLabel } from "@/components/audio/audio-model-option-label"
import { AudioVoiceSelector } from "@/components/audio/voice-selector"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Textarea } from "@/components/ui/textarea"
import {
  AUDIO_PROVIDER_OPTIONS,
  DEFAULT_AUDIO_PROVIDER,
  DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE,
  GOOGLE_GEMINI_TTS_MODEL,
  GOOGLE_GEMINI_TTS_MODEL_LABEL,
  getAudioModelIconSrc,
  getDefaultAudioModel,
  getDefaultAudioVoiceId,
  type AudioProvider,
  type AudioVoice,
} from "@/lib/constants/audio"
import {
  DEFAULT_INWORLD_TTS_MODEL,
  INWORLD_TTS_MODEL_OPTIONS,
  getInworldTtsModelOption,
} from "@/lib/constants/inworld-tts"

export interface GenerateVoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (audio: { url: string }) => void
}

const GOOGLE_TAGS_HELPER =
  "Gemini supports inline tags like [laughing], [whispering], [shouting], [short pause], and [medium pause]."

export function GenerateVoiceDialog({
  open,
  onOpenChange,
  onSuccess,
}: GenerateVoiceDialogProps) {
  const [text, setText] = React.useState("")
  const [provider, setProvider] =
    React.useState<AudioProvider>(DEFAULT_AUDIO_PROVIDER)
  const [voiceId, setVoiceId] = React.useState(getDefaultAudioVoiceId(DEFAULT_AUDIO_PROVIDER))
  const [model, setModel] = React.useState<string>(DEFAULT_INWORLD_TTS_MODEL)
  const [stylePrompt, setStylePrompt] = React.useState("")
  const [languageCode, setLanguageCode] = React.useState<string>(
    DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE
  )
  const [selectedVoice, setSelectedVoice] = React.useState<AudioVoice | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isEnhancing, setIsEnhancing] = React.useState(false)
  const [generatedAudio, setGeneratedAudio] = React.useState<{ url: string } | null>(
    null
  )

  React.useEffect(() => {
    if (!open) return

    setText("")
    setProvider(DEFAULT_AUDIO_PROVIDER)
    setVoiceId(getDefaultAudioVoiceId(DEFAULT_AUDIO_PROVIDER))
    setModel(getDefaultAudioModel(DEFAULT_AUDIO_PROVIDER))
    setStylePrompt("")
    setLanguageCode(DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE)
    setSelectedVoice(null)
    setError(null)
    setGeneratedAudio(null)
    setIsEnhancing(false)
    setIsGenerating(false)
  }, [open])

  React.useEffect(() => {
    setVoiceId(getDefaultAudioVoiceId(provider))
    setModel(getDefaultAudioModel(provider))
    setSelectedVoice(null)
    setError(null)
    if (provider === "inworld") {
      setStylePrompt("")
    } else if (!languageCode.trim()) {
      setLanguageCode(DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE)
    }
  }, [provider, languageCode])

  const canGenerate = text.trim() !== "" && voiceId.trim() !== ""

  const handleEnhance = async () => {
    if (!text.trim() || isEnhancing || isGenerating) return

    setError(null)
    setIsEnhancing(true)

    try {
      const response = await fetch("/api/enhance-tts-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          text: text.trim(),
          voice: voiceId,
          stylePrompt,
          languageCode,
        }),
      })

      const data = (await response.json().catch(() => ({}))) as {
        text?: string
        stylePrompt?: string
        error?: string
        message?: string
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to enhance audio script")
      }

      if (!data.text?.trim()) {
        throw new Error("The enhancer returned empty text.")
      }

      setText(data.text)
      if (provider === "google" && typeof data.stylePrompt === "string") {
        setStylePrompt(data.stylePrompt)
      }
    } catch (enhanceError) {
      setError(
        enhanceError instanceof Error
          ? enhanceError.message
          : "Failed to enhance audio script"
      )
    } finally {
      setIsEnhancing(false)
    }
  }

  const handleGenerate = async () => {
    if (!canGenerate || isGenerating) return

    setError(null)
    setIsGenerating(true)

    try {
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          text: text.trim(),
          voice: voiceId,
          model,
          stylePrompt: provider === "google" ? stylePrompt : undefined,
          languageCode: provider === "google" ? languageCode : undefined,
        }),
      })

      const data = (await response.json().catch(() => ({}))) as {
        audio?: { url?: string }
        error?: string
        message?: string
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to generate audio")
      }

      if (data.audio?.url) {
        setGeneratedAudio({ url: data.audio.url })
      } else {
        throw new Error("No audio URL in response")
      }
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Failed to generate audio"
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = () => {
    if (!generatedAudio) return
    onSuccess(generatedAudio)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {generatedAudio ? (
          <>
            <DialogHeader>
              <DialogTitle>Voice line generated</DialogTitle>
              <DialogDescription>
                Your voice line is ready. Save to use it or generate another.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <audio
                src={generatedAudio.url}
                controls
                className="w-full max-h-12 rounded-lg"
              />
            </div>
            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setGeneratedAudio(null)}
              >
                Generate again
              </Button>
              <div className="flex gap-2">
                <DialogClose>Cancel</DialogClose>
                <Button onClick={handleSave}>Save</Button>
              </div>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Generate voice line</DialogTitle>
              <DialogDescription>
                Generate speech with Inworld or Google Gemini TTS.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Provider</Label>
                <Select
                  value={provider}
                  onValueChange={(nextProvider) =>
                    setProvider(nextProvider as AudioProvider)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIO_PROVIDER_OPTIONS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="generate-voice-text">Text</Label>
                <Textarea
                  id="generate-voice-text"
                  placeholder="Text to speak"
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value)
                    setError(null)
                  }}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="grid gap-2">
                <Label>Voice</Label>
                <AudioVoiceSelector
                  provider={provider}
                  value={voiceId}
                  onSelectedVoiceChange={setSelectedVoice}
                  onValueChange={(nextVoiceId) => {
                    setVoiceId(nextVoiceId)
                    setError(null)
                  }}
                />
                <p className="text-xs text-zinc-500">
                  Selected voice: {selectedVoice?.displayName ?? voiceId}
                </p>
              </div>

              {provider === "inworld" ? (
                <div className="grid gap-2">
                  <Label>Model</Label>
                  <Select
                    value={model}
                    onValueChange={(nextModel) => {
                      setModel(nextModel)
                      setError(null)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Current</SelectLabel>
                        {INWORLD_TTS_MODEL_OPTIONS.filter(
                          (option) => option.group === "Current"
                        ).map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            <AudioModelOptionLabel modelId={option.id}>
                              {option.label}
                            </AudioModelOptionLabel>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Legacy</SelectLabel>
                        {INWORLD_TTS_MODEL_OPTIONS.filter(
                          (option) => option.group === "Legacy"
                        ).map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            <AudioModelOptionLabel modelId={option.id}>
                              {option.label}
                            </AudioModelOptionLabel>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-zinc-500">
                    {getInworldTtsModelOption(model)?.description ??
                      "Choose the Inworld TTS model that fits your latency and quality needs."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label>Model</Label>
                    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-foreground">
                      <img
                        src={getAudioModelIconSrc(GOOGLE_GEMINI_TTS_MODEL)}
                        alt=""
                        className="size-4 shrink-0"
                        width={16}
                        height={16}
                      />
                      <span>{GOOGLE_GEMINI_TTS_MODEL_LABEL}</span>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="generate-voice-language">Language Code</Label>
                    <Input
                      id="generate-voice-language"
                      value={languageCode}
                      onChange={(event) => {
                        setLanguageCode(event.target.value)
                        setError(null)
                      }}
                      placeholder={DEFAULT_GOOGLE_GEMINI_LANGUAGE_CODE}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="generate-voice-style">Style Prompt</Label>
                    <Textarea
                      id="generate-voice-style"
                      value={stylePrompt}
                      onChange={(event) => {
                        setStylePrompt(event.target.value)
                        setError(null)
                      }}
                      placeholder="Describe the tone, pace, accent, or delivery..."
                      rows={3}
                      className="resize-none"
                    />
                    <p className="text-xs text-zinc-500">{GOOGLE_TAGS_HELPER}</p>
                  </div>
                </>
              )}

              {error ? <p className="text-destructive text-sm">{error}</p> : null}
            </div>

            <DialogFooter className="gap-2">
              <DialogClose>Cancel</DialogClose>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void handleEnhance()
                }}
                disabled={!text.trim() || isEnhancing || isGenerating}
              >
                {isEnhancing ? (
                  <>
                    <CircleNotch className="mr-2 size-4 animate-spin" />
                    Enhancing...
                  </>
                ) : (
                  <>
                    Enhance
                    <Sparkle className="ml-2 size-4" weight="fill" />
                  </>
                )}
              </Button>
              <Button onClick={handleGenerate} disabled={!canGenerate || isGenerating}>
                {isGenerating ? (
                  <>
                    <CircleNotch className="mr-2 size-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
