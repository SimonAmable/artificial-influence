import type { Dispatch, SetStateAction } from "react"

import type { AttachedRef } from "@/lib/commands/types"

export type ImageGridAgentAction = "reference" | "edit" | "recreate" | "animate"

export type ImageGridAgentActionContext = {
  imageUrl: string
  prompt?: string | null
  model?: string | null
  aspectRatio?: string | null
  referenceImageUrls?: string[]
}

function createChipId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function attachedRefFromImageUrl(url: string, label: string): AttachedRef {
  const chipId = createChipId()
  return {
    id: chipId,
    label,
    category: "asset",
    assetType: "image",
    assetUrl: url,
    previewUrl: url,
    serialized: `Reference (image) "${label}": ${url}`,
    chipId,
    mentionToken: "",
  }
}

function dedupeRefsByUrl(refs: AttachedRef[]): AttachedRef[] {
  const seen = new Set<string>()
  return refs.filter((ref) => {
    const url = ref.assetUrl?.trim()
    if (!url || seen.has(url)) return false
    seen.add(url)
    return true
  })
}

export function buildImageGridAgentInjection(
  action: ImageGridAgentAction,
  context: ImageGridAgentActionContext,
): string {
  const promptLine = context.prompt?.trim()
    ? `\n\nOriginal prompt: "${context.prompt.trim()}"`
    : ""
  const modelLine = context.model?.trim() ? `\nModel hint: ${context.model.trim()}` : ""
  const aspectLine = context.aspectRatio?.trim() ? `\nAspect: ${context.aspectRatio.trim()}` : ""

  switch (action) {
    case "reference":
      return "Use the attached image as a reference for my next generation. I want: "
    case "edit":
      return "Edit the attached image. Changes to apply: "
    case "recreate":
      return `Recreate this image with the same concept and quality.${promptLine}${modelLine}${aspectLine}`
    case "animate":
      return "Turn the attached image into a video using it as the start frame.\n\nMotion / duration: "
    default: {
      const _exhaustive: never = action
      return String(_exhaustive)
    }
  }
}

export function buildAttachedRefsForAgentAction(
  action: ImageGridAgentAction,
  context: ImageGridAgentActionContext,
): AttachedRef[] {
  const outputRef = attachedRefFromImageUrl(context.imageUrl, "Generated image")

  if (action === "recreate") {
    const refUrls =
      context.referenceImageUrls && context.referenceImageUrls.length > 0
        ? context.referenceImageUrls
        : [context.imageUrl]
    return dedupeRefsByUrl(
      refUrls.map((url, index) =>
        attachedRefFromImageUrl(
          url,
          index === 0 && refUrls.length > 1 ? "Reference image" : "Generated image",
        ),
      ),
    )
  }

  return [outputRef]
}

export function toImageGridAgentContext(image: {
  url: string
  prompt?: string | null
  model?: string | null
  aspectRatio?: string | null
  referenceImageUrls?: string[]
}): ImageGridAgentActionContext {
  return {
    imageUrl: image.url,
    prompt: image.prompt ?? null,
    model: image.model ?? null,
    aspectRatio: image.aspectRatio ?? null,
    referenceImageUrls: image.referenceImageUrls ?? [],
  }
}

export function applyImageGridAgentAction({
  action,
  context,
  setComposerValue,
  setAttachedRefs,
  focusComposer,
}: {
  action: ImageGridAgentAction
  context: ImageGridAgentActionContext
  setComposerValue: (value: string) => void
  setAttachedRefs: Dispatch<SetStateAction<AttachedRef[]>>
  focusComposer?: () => void
}): void {
  setComposerValue(buildImageGridAgentInjection(action, context))
  const nextRefs = buildAttachedRefsForAgentAction(action, context)
  setAttachedRefs(nextRefs)
  focusComposer?.()
}
