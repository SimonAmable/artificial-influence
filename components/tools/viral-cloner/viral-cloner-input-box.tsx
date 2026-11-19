"use client"

import * as React from "react"
import { LinkSimple, UploadSimple } from "@phosphor-icons/react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhotoUpload, type ImageUpload } from "@/components/shared/upload/photo-upload"
import { GenerateShaderButton } from "@/components/tools/influencer/generate-shader-button"
import { cn } from "@/lib/utils"

export type ViralClonerInputBoxProps = {
  className?: string
  referenceImage: ImageUpload | null
  onReferenceImageChange: (next: ImageUpload | null) => void
  onOpenLibrary: () => void
  sourceUrl: string
  onSourceUrlChange: (value: string) => void
  inspecting?: boolean
  acceptedRights: boolean
  onAcceptedRightsChange: (value: boolean) => void
  selectedCount: number
  creditTotal: number
  isReady: boolean
  isSubmitting: boolean
  onGenerate: () => void
}

export function ViralClonerInputBox({
  className,
  referenceImage,
  onReferenceImageChange,
  onOpenLibrary,
  sourceUrl,
  onSourceUrlChange,
  inspecting = false,
  acceptedRights,
  onAcceptedRightsChange,
  selectedCount,
  creditTotal,
  isReady,
  isSubmitting,
  onGenerate,
}: ViralClonerInputBoxProps) {
  return (
    <Card
      className={cn(
        "w-full max-w-sm sm:max-w-lg lg:max-w-4xl relative transition-colors bg-background/95 backdrop-blur-sm overflow-visible",
        className,
      )}
    >
      <CardContent className="flex min-w-0 flex-col gap-2 p-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Reference character</Label>
          <div className="flex flex-wrap items-end gap-2">
            <PhotoUpload
              value={referenceImage}
              onChange={onReferenceImageChange}
              title="Character"
              description="Face to clone onto"
              className="h-24 w-24 shrink-0"
            />
            <Button type="button" variant="outline" size="sm" onClick={onOpenLibrary}>
              <UploadSimple className="mr-1.5 size-4" />
              Library
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="viral-source-url" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LinkSimple className="size-3.5" />
            Post or media URL
          </Label>
          <Input
            id="viral-source-url"
            value={sourceUrl}
            onChange={(event) => onSourceUrlChange(event.target.value)}
            placeholder="TikTok, Instagram, RedGifs, direct image…"
            className="font-mono text-sm"
          />
          {inspecting ? <p className="text-xs text-muted-foreground">Inspecting…</p> : null}
        </div>

        <div className="flex min-w-0 items-center gap-2 border-t border-border/60 pt-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={acceptedRights}
              onCheckedChange={(v) => onAcceptedRightsChange(v === true)}
            />
            <span className="leading-snug">I have the right to clone this media.</span>
          </label>
          <div className="ml-auto shrink-0">
            <GenerateShaderButton
              layout="icon"
              isReady={isReady}
              isGenerating={isSubmitting}
              allowConcurrent={false}
              onGenerate={onGenerate}
              creditCost={selectedCount > 0 && creditTotal > 0 ? creditTotal : "—"}
              label={
                selectedCount > 0
                  ? `Clone ${selectedCount}`
                  : "Clone"
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}