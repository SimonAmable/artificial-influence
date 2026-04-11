import type { AssetType } from "@/lib/assets/types"
import type { Model } from "@/lib/types/models"

/**
 * Which library asset types may appear in @ for the selected video model.
 * Brand kits are always available (separate from asset type filter).
 */
export function allowedAssetTypesForVideoModel(model: Model): AssetType[] {
  const id = model.identifier
  const types = new Set<AssetType>()

  const params = model.parameters?.parameters ?? []
  const hasStartOrImageParam = params.some((p) =>
    ["image", "first_frame_image", "start_image"].includes(p.name)
  )
  const hasLastFrame = params.some((p) => p.name === "last_frame" || p.name === "last_frame_image")

  const isKlingOmni = id === "kwaivgi/kling-v3-omni-video"
  const isSeedance = id === "bytedance/seedance-2.0"
  const isKlingV3 = id === "kwaivgi/kling-v3-video"
  const isMotionCopy =
    id === "kwaivgi/kling-v2.6-motion-control" || id === "kwaivgi/kling-v3-motion-control"
  const isLipsync =
    id.includes("lipsync") || id.includes("wav2lip") || id === "veed/fabric-1.0"

  if (isMotionCopy || isLipsync) {
    return []
  }

  if (
    model.supports_reference_image === true ||
    hasStartOrImageParam ||
    hasLastFrame ||
    isKlingOmni ||
    isKlingV3
  ) {
    types.add("image")
  }

  if (
    model.supports_reference_video === true ||
    isKlingOmni ||
    isSeedance ||
    id === "xai/grok-imagine-video"
  ) {
    types.add("video")
  }

  if (types.size === 0 && model.type === "video") {
    types.add("image")
  }

  return Array.from(types)
}
