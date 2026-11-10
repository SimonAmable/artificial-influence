import { GENJUTSU_MAX_REFERENCE_IMAGES } from "./constants"

const CLOTHING_WORD = /\b(outfit|clothing|clothes|jacket|wardrobe|dress|shirt|wear|wearing)\b/i
const REFERENCE_WORD = /\b(sheet|reference|image|images|character)\b/i

export function editOverridesClothing(edit: string): boolean {
  return CLOTHING_WORD.test(edit) && REFERENCE_WORD.test(edit)
}

export function buildGenjutsuPrompt(imageCount: number, edit?: string | null): string {
  const count = Math.min(GENJUTSU_MAX_REFERENCE_IMAGES, Math.max(1, Math.round(imageCount)))
  const images = count === 1 ? "Image 1" : `Image 1 through Image ${count}`
  const samePerson = count === 1 ? "" : ` ${images} are the same person.`
  const editText = edit?.trim() ?? ""
  const clothingLine = editOverridesClothing(editText)
    ? "Clothing named in the edit comes from the character images. Motion, expression, camera, background, and lighting still come from Video 1."
    : "Motion, expression, camera, clothing, background, and lighting come only from Video 1."

  const parts = [
    `Motion swap with the character's identity preserved. The person in Video 1 performs the same motion, but their identity is the person in ${images}.${samePerson}`,
    "Identity, face, and appearance come only from the character images. Do not carry over any look that belongs to the original person and is absent from the references.",
    clothingLine,
  ]

  if (editText) {
    parts.push(`Edit: ${editText}`)
  }

  return parts.join(" ")
}
