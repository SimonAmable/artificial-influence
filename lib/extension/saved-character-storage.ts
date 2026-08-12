import type { ImageUpload } from "@/components/shared/upload/photo-upload"

export const EXTENSION_SAVED_CHARACTER_STORAGE_KEY = "unican:extension-saved-character"

export type SavedExtensionCharacter = {
  url: string
  assetId: string
  title?: string | null
  savedAt: number
}

export function parseSavedExtensionCharacter(raw: string | null): SavedExtensionCharacter | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<SavedExtensionCharacter>
    if (typeof parsed.url !== "string" || parsed.url.length === 0) return null
    if (typeof parsed.assetId !== "string" || parsed.assetId.length === 0) return null

    return {
      url: parsed.url,
      assetId: parsed.assetId,
      title: typeof parsed.title === "string" ? parsed.title : null,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    }
  } catch {
    return null
  }
}

export function serializeSavedExtensionCharacter(
  value: SavedExtensionCharacter | null,
): string | null {
  if (!value) return null
  return JSON.stringify(value)
}

export function savedCharacterToImageUpload(saved: SavedExtensionCharacter): ImageUpload {
  return { url: saved.url }
}

export function imageUploadToSavedCharacter(
  image: ImageUpload | null,
  meta?: { assetId?: string | null; title?: string | null },
): SavedExtensionCharacter | null {
  if (!image?.url) return null
  if (typeof meta?.assetId !== "string" || meta.assetId.length === 0) return null

  return {
    url: image.url,
    assetId: meta.assetId,
    title: meta?.title ?? null,
    savedAt: Date.now(),
  }
}

/** Web preview storage. WXT extension should mirror this shape in chrome.storage.local. */
export async function loadSavedExtensionCharacter(): Promise<SavedExtensionCharacter | null> {
  if (typeof window === "undefined") return null

  const raw = window.localStorage.getItem(EXTENSION_SAVED_CHARACTER_STORAGE_KEY)
  return parseSavedExtensionCharacter(raw)
}

export async function persistSavedExtensionCharacter(
  value: SavedExtensionCharacter | null,
): Promise<void> {
  if (typeof window === "undefined") return

  if (!value?.assetId) {
    window.localStorage.removeItem(EXTENSION_SAVED_CHARACTER_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(
    EXTENSION_SAVED_CHARACTER_STORAGE_KEY,
    serializeSavedExtensionCharacter(value) ?? "",
  )
}
