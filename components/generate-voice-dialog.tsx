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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CircleNotch } from "@phosphor-icons/react"

const VOICE_PRESETS = [
  { label: "Adam", value: "pNInz6obpgDQGcFmaJgB" },
  { label: "Rachel", value: "21m00Tcm4TlvDq8ikWAM" },
  { label: "Domi", value: "AZnzlk1XvdvUeBnXmlld" },
  { label: "Bella", value: "EXAVITQu4vr4xnSDxMaL" },
] as const

const CUSTOM_VALUE = "custom"

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
  const [voicePreset, setVoicePreset] = React.useState("")
  const [customVoiceId, setCustomVoiceId] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [generatedAudio, setGeneratedAudio] = React.useState<{ url: string } | null>(null)

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setText("")
      setVoicePreset("")
      setCustomVoiceId("")
      setError(null)
      setGeneratedAudio(null)
    }
  }, [open])

  const voiceId =
    voicePreset === CUSTOM_VALUE ? customVoiceId.trim() : voicePreset

  const canGenerate =
    text.trim() !== "" &&
    (voicePreset === CUSTOM_VALUE ? customVoiceId.trim() !== "" : voicePreset !== "")

  const handleGenerate = async () => {
    if (!canGenerate || isGenerating) return
    setError(null)
    setIsGenerating(true)
    try {
      const res = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), voice: voiceId }),
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
                Generate speech with ElevenLabs. Enter text and select a voice.
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
                <Label>Voice selection</Label>
                <Select
                  value={voicePreset}
                  onValueChange={(v) => {
                    setVoicePreset(v)
                    setError(null)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_VALUE}>Custom</SelectItem>
                  </SelectContent>
                </Select>
                {voicePreset === CUSTOM_VALUE && (
                  <Input
                    placeholder="ElevenLabs voice ID"
                    value={customVoiceId}
                    onChange={(e) => {
                      setCustomVoiceId(e.target.value)
                      setError(null)
                    }}
                    className="mt-1"
                  />
                )}
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
