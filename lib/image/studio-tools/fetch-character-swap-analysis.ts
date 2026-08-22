import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import { ensureStoredReferenceImage } from "@/lib/image/ensure-stored-reference-image"
import {
  buildCharacterSwapAnalysisPayload,
  type CharacterSwapVisionHints,
} from "@/lib/image/studio-tools/character-swap-analysis"

const PAYLOAD_TOO_LARGE_MESSAGE =
  "Could not analyze character swap references. Please try again."

function isPayloadTooLargeResponse(status: number, body: string): boolean {
  if (status === 413) return true
  const haystack = body.toLowerCase()
  return (
    haystack.includes("request entity too large") ||
    haystack.includes("function_payload_too_large") ||
    haystack.includes("payload too large")
  )
}

async function readCharacterSwapAnalysisResponse(
  response: Response,
): Promise<{ hints?: CharacterSwapVisionHints; error?: string }> {
  const text = await response.text()
  if (!text.trim()) {
    if (isPayloadTooLargeResponse(response.status, text)) {
      return { error: PAYLOAD_TOO_LARGE_MESSAGE }
    }
    return {}
  }

  try {
    return JSON.parse(text) as { hints?: CharacterSwapVisionHints; error?: string }
  } catch {
    if (isPayloadTooLargeResponse(response.status, text)) {
      return { error: PAYLOAD_TOO_LARGE_MESSAGE }
    }
    return { error: text }
  }
}

export async function fetchCharacterSwapVisionHints(
  characterImage: ImageUpload,
  sceneImage: ImageUpload,
): Promise<CharacterSwapVisionHints> {
  const storedCharacter = await ensureStoredReferenceImage(characterImage)
  const storedScene = await ensureStoredReferenceImage(sceneImage)
  if (!storedCharacter || !storedScene) {
    throw new Error("Character and scene reference images are required")
  }

  const response = await fetch("/api/image/character-swap-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      buildCharacterSwapAnalysisPayload(storedCharacter.url, storedScene.url),
    ),
  })

  const result = await readCharacterSwapAnalysisResponse(response)

  if (!response.ok || !result.hints) {
    throw new Error(result.error || "Could not analyze character swap references")
  }

  return result.hints
}
