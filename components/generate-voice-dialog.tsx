"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { InworldVoiceSelector } from "@/components/audio/inworld-voice-selector"
import {
  DEFAULT_INWORLD_TTS_MODEL,
  DEFAULT_INWORLD_VOICE_ID,
  INWORLD_TTS_MODEL_OPTIONS,
  getInworldTtsModelOption,
  type InworldVoice,
} from "@/lib/constants/inworld-tts"
import { CircleNotch } from "@phosphor-icons/react"

export interface GenerateVoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (audio: { url: string }) => void
}

export function GenerateVoiceDialog({
  open,
  onOpenChange,
  onSuccess,
}: GenerateVoiceDialogProps) {
  const [text, setText] = React.useState("")
  const [voiceId, setVoiceId] = React.useState(DEFAULT_INWORLD_VOICE_ID)
  const [model, setModel] = React.useState<string>(DEFAULT_INWORLD_TTS_MODEL)
  const [selectedVoice, setSelectedVoice] = React.useState<InworldVoice | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [generatedAudio, setGeneratedAudio] = React.useState<{ url: string } | null>(null)

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setText("")
      setVoiceId(DEFAULT_INWORLD_VOICE_ID)
      setModel(DEFAULT_INWORLD_TTS_MODEL)
      setSelectedVoice(null)
      setError(null)
      setGeneratedAudio(null)
    }
  }, [open])

  const canGenerate =
    text.trim() !== "" && voiceId.trim() !== ""

  const handleGenerate = async () => {
    if (!canGenerate || isGenerating) return
    setError(null)
    setIsGenerating(true)
    try {
      const res = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          voice: voiceId,
          model,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || data.message || "Failed to generate audio")
        return
      }
      if (data.audio?.url) {
        setGeneratedAudio({ url: data.audio.url })
      } else {
        setError("No audio URL in response")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate audio")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = () => {
    if (generatedAudio) {
      onSuccess(generatedAudio)
      onOpenChange(false)
    }
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
                Generate speech with Inworld. Enter text, search voices, and choose a model.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="generate-voice-text">Text</Label>
                <Textarea
                  id="generate-voice-text"
                  placeholder="Text to speak"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value)
                    setError(null)
                  }}
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="grid gap-2">
                <Label>Voice</Label>
                <InworldVoiceSelector
                  value={voiceId}
                  onSelectedVoiceChange={setSelectedVoice}
                  onValueChange={(nextVoiceId) => {
                    setVoiceId(nextVoiceId)
                    setError(null)
                  }}
                />
                <p className="text-xs text-zinc-500">
                  Default voice ID: {selectedVoice?.voiceId ?? voiceId}
                </p>
              </div>
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
                    <SelectValue
                      placeholder="Select a model"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Current</SelectLabel>
                      {INWORLD_TTS_MODEL_OPTIONS.filter(
                        (option) => option.group === "Current"
                      ).map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
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
                          {option.label}
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
              {error && (
                <p className="text-destructive text-sm">{error}</p>
              )}
            </div>
            <DialogFooter>
              <DialogClose>Cancel</DialogClose>
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <CircleNotch className="size-4 mr-2 animate-spin" />
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
