import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import type { CharacterSwapVisionHints } from "@/lib/image/studio-tools/character-swap-analysis"

export function buildCharacterSwapAnalysisFormData(
  characterImage: ImageUpload,
  sceneImage: ImageUpload,
): FormData {
  const formData = new FormData()

  if (characterImage.file) {
    formData.append("character", characterImage.file)
  } else if (characterImage.url) {
    formData.append("characterUrl", characterImage.url)
  }

  if (sceneImage.file) {
    formData.append("scene", sceneImage.file)
  } else if (sceneImage.url) {
    formData.append("sceneUrl", sceneImage.url)
  }

  return formData
}

export async function fetchCharacterSwapVisionHints(
  characterImage: ImageUpload,
  sceneImage: ImageUpload,
): Promise<CharacterSwapVisionHints> {
  const response = await fetch("/api/image/character-swap-analysis", {
    method: "POST",
    body: buildCharacterSwapAnalysisFormData(characterImage, sceneImage),
  })

  const result = (await response.json()) as {
    hints?: CharacterSwapVisionHints
    error?: string
  }

  if (!response.ok || !result.hints) {
    throw new Error(result.error || "Could not analyze character swap references")
  }

  return result.hints
}
