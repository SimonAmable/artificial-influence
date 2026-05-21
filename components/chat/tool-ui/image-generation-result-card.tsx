"use client"

import type { UIMessage } from "ai"
import { CircleNotch } from "@phosphor-icons/react"
import { ImageGrid, type ImageGridAgentAction } from "@/components/shared/display/image-grid"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type {
  GenerateImageToolPart,
  UniversalGenerateImageToolPart,
} from "@/lib/chat/agent-tool-part-types"
import { useImageGenerationPoll } from "@/hooks/use-generation-status"
import { CreditCostBadge, PromptLengthBadge, shouldHideGenerateImageToolMessage } from "./badges"

export function ImageGenerationResultCard({
  badgeLabel,
  messageId,
  modelFallback,
  part,
  title,
  onImageGridAgentAction,
  onCreateAssetFromImage,
}: {
  badgeLabel: string
  messageId: string
  modelFallback: string
  part: GenerateImageToolPart | UniversalGenerateImageToolPart
  title: string
  allMessages: UIMessage[]
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
  const pollEnabled =
    part.state === "output-available" &&
    part.output?.status === "pending" &&
    Boolean(part.output?.predictionId)

  const polledState = useImageGenerationPoll(part.output?.predictionId, pollEnabled)

  if (part.state === "input-streaming") {
    return (
      <Card key={messageId} className="border-border/60 bg-muted/20">
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <CircleNotch className="h-4 w-4 animate-spin" />
          Preparing image generation...
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
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">Starting image generation</p>
            </div>
            <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
          <p className="text-sm leading-6 text-foreground">{part.input?.prompt}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{part.input?.modelIdentifier || modelFallback}</Badge>
            <Badge variant="outline">{part.input?.aspectRatio || "1:1"}</Badge>
            <Badge variant="outline">
              {part.input?.variantCount || 1} variation
              {(part.input?.variantCount || 1) > 1 ? "s" : ""}
            </Badge>
            <CreditCostBadge
              modelIdentifier={part.input?.modelIdentifier ?? modelFallback}
              variantCount={part.input?.variantCount ?? 1}
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (part.state === "output-error") {
    return (
      <Card key={messageId} className="border-destructive/30 bg-destructive/5">
        <CardContent className="space-y-2 p-4 text-sm text-destructive">
          <p className="font-medium">{title} failed</p>
          <p>{part.errorText || "Unknown tool error."}</p>
        </CardContent>
      </Card>
    )
  }

  if (part.state === "output-available") {
    const effectiveStatus = polledState?.status ?? part.output?.status ?? "completed"
    const effectiveImages = polledState?.images ?? part.output?.images ?? []
    const creditsUsed =
      part.output && "creditsUsed" in part.output
        ? (part.output as UniversalGenerateImageToolPart["output"])?.creditsUsed
        : undefined

    if (effectiveStatus === "failed") {
      return (
        <Card key={messageId} className="border-destructive/30 bg-destructive/5">
          <CardContent className="space-y-2 p-4 text-sm text-destructive">
            <p className="font-medium">{title} failed</p>
            <p>{polledState?.error || part.errorText || "Unknown tool error."}</p>
          </CardContent>
        </Card>
      )
    }

    if (effectiveStatus === "pending") {
      return (
        <Card key={messageId} className="border-border/60 bg-muted/10">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Image Pending</Badge>
              <Badge variant="outline">{part.output?.model || modelFallback}</Badge>
              <Badge variant="outline">{part.output?.aspectRatio || part.input?.aspectRatio || "1:1"}</Badge>
              <Badge variant="outline">
                {part.output?.usedReferenceCount || 0} reference
                {(part.output?.usedReferenceCount || 0) === 1 ? "" : "s"}
              </Badge>
              <CreditCostBadge
                modelIdentifier={part.input?.modelIdentifier ?? part.output?.model ?? modelFallback}
                variantCount={part.input?.variantCount ?? 1}
              />
              <PromptLengthBadge prompt={part.input?.prompt} />
            </div>
            {!shouldHideGenerateImageToolMessage(part.output?.message ?? null) ? (
              <p className="text-sm text-muted-foreground">{part.output?.message}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <CircleNotch className="h-4 w-4 animate-spin" />
              <span>Image generation is still running.</span>
            </div>
          </CardContent>
        </Card>
      )
    }

    const referenceImageUrls = part.output?.referenceImageUrls ?? []
    const generationId = polledState?.generationId ?? part.output?.generationId ?? undefined

    const imageGridImages = effectiveImages.map((image) => ({
      url: image.url,
      id: generationId,
      model: part.output?.model ?? modelFallback,
      prompt: part.input?.prompt ?? null,
      tool: "image",
      aspectRatio: part.output?.aspectRatio ?? "1:1",
      referenceImageUrls,
    }))

    return (
      <Card key={messageId} className="border-border/60 bg-muted/10">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{badgeLabel}</Badge>
            <Badge variant="outline">{part.output?.model || modelFallback}</Badge>
            <Badge variant="outline">{part.output?.aspectRatio || "1:1"}</Badge>
            <Badge variant="outline">
              {part.output?.usedReferenceCount || 0} reference
              {(part.output?.usedReferenceCount || 0) === 1 ? "" : "s"}
            </Badge>
            <CreditCostBadge
              modelIdentifier={part.input?.modelIdentifier ?? part.output?.model ?? modelFallback}
              variantCount={part.input?.variantCount ?? 1}
              actualCredits={creditsUsed}
            />
            <PromptLengthBadge prompt={part.input?.prompt} />
          </div>
          {!shouldHideGenerateImageToolMessage(part.output?.message ?? null) ? (
            <p className="text-sm text-muted-foreground">{part.output?.message}</p>
          ) : null}
          {effectiveImages.length > 0 ? (
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
