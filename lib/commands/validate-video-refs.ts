import type { AttachedRef } from "./types"
import type { Model } from "@/lib/types/models"
import { allowedAssetTypesForVideoModel } from "./allowed-asset-types"

/** Returns an error message if any @-attached asset is incompatible with the model, else null. */
export function validateVideoAttachedRefs(refs: AttachedRef[], model: Model): string | null {
  const allowed = new Set(allowedAssetTypesForVideoModel(model))
  for (const r of refs) {
    if (r.category !== "asset" || !r.assetType) continue
    if (!allowed.has(r.assetType)) {
      return `This model does not support @ references of type “${r.assetType}”. Remove those chips or pick a different model.`
    }
  }
  return null
}
