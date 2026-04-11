import type { Model } from "@/lib/types/models"
import type { AttachedRef } from "./types"

function imageAssetRefs(refs: AttachedRef[]): AttachedRef[] {
  return refs.filter(
    (r) => r.category === "asset" && r.assetType === "image" && r.assetUrl?.trim()
  )
}

function videoAssetRefs(refs: AttachedRef[]): AttachedRef[] {
  return refs.filter(
    (r) => r.category === "asset" && r.assetType === "video" && r.assetUrl?.trim()
  )
}

export type VideoChipSlotOptions = {
  hasInputImage: boolean
  hasLastFrame: boolean
  hasReferenceVideo: boolean
}

/**
 * Maps @ image/video library assets to model input slots (same URLs sent to the API as manual uploads).
 * - Kling Omni: first image @ = start frame when no manual start; remaining image @ = style reference_images; video @ = reference_video.
 * - Other models: first image @ = input/start when supported; second image @ = last frame when supported; first video @ = reference video when supported.
 */
export function getVideoChipSlotInfo(model: Model, attachedRefs: AttachedRef[], opts: VideoChipSlotOptions) {
  const id = model.identifier
  const imgs = imageAssetRefs(attachedRefs)
  const vids = videoAssetRefs(attachedRefs)
  const isOmni = id === "kwaivgi/kling-v3-omni-video"
  const isSeedance = id === "bytedance/seedance-2.0"
  const useOmniStyleChips = isOmni || (isSeedance && opts.hasReferenceVideo)

  const supportsInput =
    model.parameters?.parameters?.some((p) =>
      ["image", "first_frame_image", "start_image"].includes(p.name)
    ) ?? false
  const supportsLast =
    model.parameters?.parameters?.some((p) =>
      ["last_frame", "last_frame_image"].includes(p.name)
    ) ?? false

  let imgIdx = 0
  let startImageChipUrl: string | null = null
  let lastFrameChipUrl: string | null = null
  const omniStyleImageChipUrls: string[] = []
  let startImageRef: AttachedRef | null = null
  let lastFrameRef: AttachedRef | null = null
  const omniStyleImageRefs: AttachedRef[] = []

  if (useOmniStyleChips) {
    if (!opts.hasInputImage && imgs[imgIdx]) {
      startImageChipUrl = imgs[imgIdx].assetUrl!.trim()
      startImageRef = imgs[imgIdx]
      imgIdx++
    }
    for (; imgIdx < imgs.length; imgIdx++) {
      omniStyleImageChipUrls.push(imgs[imgIdx].assetUrl!.trim())
      omniStyleImageRefs.push(imgs[imgIdx])
    }
  } else {
    if (supportsInput && !opts.hasInputImage && imgs[imgIdx]) {
      startImageChipUrl = imgs[imgIdx].assetUrl!.trim()
      startImageRef = imgs[imgIdx]
      imgIdx++
    }
    if (supportsLast && !opts.hasLastFrame && imgs[imgIdx]) {
      lastFrameChipUrl = imgs[imgIdx].assetUrl!.trim()
      lastFrameRef = imgs[imgIdx]
      imgIdx++
    }
  }

  let referenceVideoRef: AttachedRef | null = null
  let referenceVideoChipUrl: string | null = null
  if (!opts.hasReferenceVideo && vids[0]) {
    referenceVideoChipUrl = vids[0].assetUrl!.trim()
    referenceVideoRef = vids[0]
  }

  return {
    startImageChipUrl,
    lastFrameChipUrl,
    omniStyleImageChipUrls,
    omniStyleImageRefs,
    referenceVideoChipUrl,
    startImageRef,
    lastFrameRef,
    referenceVideoRef,
    /** True when an @ image is used as the primary input/start slot (no manual upload for that slot). */
    inputSlotFromChip: Boolean(startImageChipUrl),
    lastFrameSlotFromChip: Boolean(lastFrameChipUrl),
    referenceVideoSlotFromChip: Boolean(referenceVideoChipUrl),
    imageAssetRefs: imgs,
    videoAssetRefs: vids,
  }
}
