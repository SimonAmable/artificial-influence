"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getModelMetadataCost } from "@/lib/constants/model-metadata"

export function formatCredits(value: number): string {
  if (!Number.isFinite(value)) return "0"
  if (value === 0) return "0"
  if (value >= 1) return value % 1 === 0 ? value.toFixed(0) : value.toFixed(2)
  if (value >= 0.01) return value.toFixed(3)
  return value.toFixed(4)
}

export function CreditCostBadge({
  modelIdentifier,
  variantCount = 1,
  actualCredits,
}: {
  modelIdentifier?: string | null
  variantCount?: number | null
  actualCredits?: number | null
}) {
  if (typeof actualCredits === "number" && actualCredits > 0) {
    return <Badge variant="outline">{formatCredits(actualCredits)} credits</Badge>
  }
  if (!modelIdentifier) return null
  const perImageCost = getModelMetadataCost(modelIdentifier)
  if (!perImageCost) return null
  const variants = variantCount && variantCount > 0 ? variantCount : 1
  const estimated = perImageCost * variants
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="cursor-help">
          ~{formatCredits(estimated)} credits
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left">
        Estimated cost: {formatCredits(perImageCost)} credits per image × {variants} variation
        {variants === 1 ? "" : "s"}. Final cost shown once generation completes.
      </TooltipContent>
    </Tooltip>
  )
}

export function PromptLengthBadge({ prompt }: { prompt?: string | null }) {
  if (!prompt) return null
  const length = prompt.length
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="cursor-help">
          prompt: {length} {length === 1 ? "char" : "chars"}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm whitespace-pre-wrap wrap-break-word text-left">
        {prompt}
      </TooltipContent>
    </Tooltip>
  )
}

/** Tool outputs used to repeat agent instructions — hide so the card stays end-user readable. */
export function shouldHideGenerateImageToolMessage(message: string | undefined | null) {
  if (message === undefined || message === null || message.trim().length === 0) return true
  return (
    message.includes("no later tool in this same turn") ||
    message.startsWith("Started an image generation with")
  )
}
