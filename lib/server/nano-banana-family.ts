import { MODEL_IDENTIFIERS } from "@/lib/constants/models"

const NANO_BANANA_FAMILY_IDENTIFIERS = new Set<string>([
  MODEL_IDENTIFIERS.GOOGLE_NANO_BANANA,
  MODEL_IDENTIFIERS.GOOGLE_NANO_BANANA_PRO,
  MODEL_IDENTIFIERS.GOOGLE_NANO_BANANA_2,
  MODEL_IDENTIFIERS.GOOGLE_NANO_BANANA_2_LITE,
])

export function isNanoBananaFamilyModel(modelIdentifier: string): boolean {
  return NANO_BANANA_FAMILY_IDENTIFIERS.has(modelIdentifier)
}
