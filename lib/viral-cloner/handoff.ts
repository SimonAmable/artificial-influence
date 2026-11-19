export const VIRAL_CLONER_HANDOFF_STORAGE_KEY = "unican:viral-cloner-handoff"

export type ViralClonerHandoff = {
  characterAssetId?: string | null
  characterPreviewUrl?: string | null
}

export function saveViralClonerHandoff(handoff: ViralClonerHandoff): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(VIRAL_CLONER_HANDOFF_STORAGE_KEY, JSON.stringify(handoff))
}

export function consumeViralClonerHandoff(): ViralClonerHandoff | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(VIRAL_CLONER_HANDOFF_STORAGE_KEY)
  if (!raw) return null
  sessionStorage.removeItem(VIRAL_CLONER_HANDOFF_STORAGE_KEY)
  try {
    return JSON.parse(raw) as ViralClonerHandoff
  } catch {
    return null
  }
}