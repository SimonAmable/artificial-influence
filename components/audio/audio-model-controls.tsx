"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
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
import { Switch } from "@/components/ui/switch"
import {
  QWEN3_TTS_LANGUAGES,
  SEED_AUDIO_OUTPUT_FORMATS,
  SEED_AUDIO_SAMPLE_RATES,
  type AudioProvider,
} from "@/lib/constants/audio"

export interface SeedAudioSettings {
  voice: string
  referenceAudios: File[]
  referenceImage: File | null
  outputFormat: string
  sampleRate: number
  speed: number
  volume: number
  pitch: number
  multilingual: boolean
}

export function AudioModelControls({
  open,
  onOpenChange,
  provider,
  qwenLanguage,
  onQwenLanguageChange,
  styleInstruction,
  onStyleInstructionChange,
  seed,
  onSeedChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: AudioProvider
  qwenLanguage: string
  onQwenLanguageChange: (value: string) => void
  styleInstruction: string
  onStyleInstructionChange: (value: string) => void
  seed: SeedAudioSettings
  onSeedChange: (value: SeedAudioSettings) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-[28px] border border-border/60 bg-card p-6 shadow-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-bold uppercase tracking-tight">
            {provider === "qwen" ? "Qwen Voice Controls" : "Seed Audio Controls"}
          </DialogTitle>
          <DialogDescription>
            {provider === "qwen"
              ? "Set the language and delivery used by preset and saved voices."
              : "Shape the output and optionally guide it with audio or one image."}
          </DialogDescription>
        </DialogHeader>

        {provider === "qwen" ? (
          <div className="space-y-4 py-2">
            <Select value={qwenLanguage} onValueChange={onQwenLanguageChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {QWEN3_TTS_LANGUAGES.map((language) => (
                  <SelectItem key={language} value={language}>{language}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <textarea
              value={styleInstruction}
              onChange={(event) => onStyleInstructionChange(event.target.value)}
              placeholder="Speak slowly and calmly, with gentle emphasis..."
              rows={5}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
            />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              Preset or cloned voice ID
              <Input
                value={seed.voice}
                onChange={(event) => onSeedChange({ ...seed, voice: event.target.value })}
                placeholder="Optional — leave blank for automatic"
              />
            </label>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Audio references · up to 3
              </p>
              <Input
                type="file"
                multiple
                accept="audio/*,.wav,.mp3,.pcm,.ogg,.opus"
                disabled={Boolean(seed.referenceImage)}
                onChange={(event) =>
                  onSeedChange({
                    ...seed,
                    referenceAudios: Array.from(event.target.files ?? []).slice(0, 3),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Image reference · cannot combine with audio
              </p>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={seed.referenceAudios.length > 0}
                onChange={(event) =>
                  onSeedChange({
                    ...seed,
                    referenceImage: event.target.files?.[0] ?? null,
                  })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={seed.outputFormat}
                onValueChange={(value) => onSeedChange({ ...seed, outputFormat: value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEED_AUDIO_OUTPUT_FORMATS.map((format) => (
                    <SelectItem key={format} value={format}>{format}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(seed.sampleRate)}
                onValueChange={(value) =>
                  onSeedChange({ ...seed, sampleRate: Number(value) })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEED_AUDIO_SAMPLE_RATES.map((rate) => (
                    <SelectItem key={rate} value={String(rate)}>{rate} Hz</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="space-y-1 text-xs text-muted-foreground">
                Speed
                <Input
                  type="number"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={seed.speed}
                  onChange={(event) =>
                    onSeedChange({ ...seed, speed: Number(event.target.value) })
                  }
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Volume
                <Input
                  type="number"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={seed.volume}
                  onChange={(event) =>
                    onSeedChange({ ...seed, volume: Number(event.target.value) })
                  }
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Pitch
                <Input
                  type="number"
                  min={-12}
                  max={12}
                  step={1}
                  value={seed.pitch}
                  onChange={(event) =>
                    onSeedChange({ ...seed, pitch: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <label className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm">
              Better mixed-language handling
              <Switch
                checked={seed.multilingual}
                onCheckedChange={(checked) =>
                  onSeedChange({ ...seed, multilingual: checked })
                }
              />
            </label>
          </div>
        )}

        <Button onClick={() => onOpenChange(false)}>Done</Button>
      </DialogContent>
    </Dialog>
  )
}
