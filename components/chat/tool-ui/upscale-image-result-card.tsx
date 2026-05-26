"use client"

import { CircleNotch } from "@phosphor-icons/react"
import { ImageGrid, type ImageGridAgentAction } from "@/components/shared/display/image-grid"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { UpscaleImageToolPart } from "@/lib/chat/agent-tool-part-types"
import { CreditCostBadge, shouldHideGenerateImageToolMessage } from "./badges"

export function UpscaleImageResultCard({
  messageId,
  part,
  onImageGridAgentAction,
  onCreateAssetFromImage,
}: {
  messageId: string
  part: UpscaleImageToolPart
  onImageGridAgentAction?: (
    action: ImageGridAgentAction,
    image: {
      url: string
      prompt?: string | null
      model?: string | null
      aspectRatio?: string | null
      referenceImageUrls?: string[]
    },
  ) => void
  onCreateAssetFromImage?: (imageUrl: string, index: number) => void
}) {
  const modelFallback = "prunaai/p-image-upscale"

  if (part.state === "input-streaming") {
    return (
      <Card key={messageId} className="border-border/60 bg-muted/20">
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <CircleNotch className="h-4 w-4 animate-spin" />
          Preparing upscale...
        </CardContent>
      </Card>
    )
  }

  if (part.state === "input-available") {
    return (
      <Card key={messageId} className="border-border/60 bg-muted/20">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Image Upscale</p>
              <p className="text-xs text-muted-foreground">Upscaling source image</p>
            </div>
            <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{part.input?.modelIdentifier || modelFallback}</Badge>
            {part.input?.targetMegapixels != null ? (
              <Badge variant="outline">{part.input.targetMegapixels} MP target</Badge>
            ) : null}
            {part.input?.enhanceRealism ? <Badge variant="outline">Realism</Badge> : null}
            {part.input?.enhanceDetails ? <Badge variant="outline">Details</Badge> : null}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (part.state === "output-error") {
    return (
      <Card key={messageId} className="border-destructive/30 bg-destructive/5">
        <CardContent className="space-y-2 p-4 text-sm text-destructive">
          <p className="font-medium">Image upscale failed</p>
          <p>{part.errorText || "Unknown tool error."}</p>
        </CardContent>
      </Card>
    )
  }

  if (part.state === "output-available") {
    const images = part.output?.images ?? []
    const generationId = part.output?.generationId ?? undefined
    const referenceImageUrls = part.output?.referenceImageUrls ?? []

    const imageGridImages = images.map((image) => ({
      url: image.url,
      id: generationId,
      model: part.output?.model ?? modelFallback,
      prompt: null,
      tool: "upscale",
      aspectRatio: "1:1",
      referenceImageUrls,
    }))

    return (
      <Card key={messageId} className="border-border/60 bg-muted/10">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Upscaled</Badge>
            <Badge variant="outline">{part.output?.model || modelFallback}</Badge>
            <Badge variant="outline">1 source</Badge>
            <CreditCostBadge
              modelIdentifier={part.input?.modelIdentifier ?? part.output?.model ?? modelFallback}
              variantCount={1}
              actualCredits={part.output?.creditsUsed}
            />
          </div>
          {!shouldHideGenerateImageToolMessage(part.output?.message ?? null) ? (
            <p className="text-sm text-muted-foreground">{part.output?.message}</p>
          ) : null}
          {images.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
              {onImageGridAgentAction ? (
                <ImageGrid
                  images={imageGridImages}
                  className="h-auto"
                  actionStrategy="agent"
                  showColumnSlider={false}
                  initialColumnCount={1}
                  onAgentAction={(action, image) => onImageGridAgentAction(action, image)}
                  onCreateAsset={onCreateAssetFromImage}
                />
              ) : (
                <ImageGrid images={imageGridImages} className="h-auto" basicActionsOnly initialColumnCount={1} />
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  return null
}
