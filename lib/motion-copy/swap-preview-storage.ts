import {
  isMotionCopySwapActive,
  parseMotionCopySwapMode,
  type MotionCopySwapMode,
} from "@/lib/motion-copy/swap-mode"

export type MotionSwapPreviewSlot = {
  clientRequestId: string
  startedAt: string
  swapMode: MotionCopySwapMode
  status: "pending" | "ready" | "failed"
  beforeUrl?: string | null
  afterUrl?: string | null
  error?: string | null
  swapCredits: number
  videoCredits: number | null
  /** Original character upload URL — used to retry after refresh. */
  characterImageUrl?: string | null
  /** Driving video URL — used to continue/retry after refresh. */
  drivingVideoUrl?: string | null
}

export type SwapPreviewSurface = "motion-copy" | "video"

const STORAGE_KEYS: Record<SwapPreviewSurface, string> = {
  "motion-copy": "unican-motion-copy-swap-previews-v1",
  video: "unican-video-motion-swap-previews-v1",
}

const MAX_PERSISTED_SLOTS = 24

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isPersistableSlot(value: unknown): value is MotionSwapPreviewSlot {
  if (!isRecord(value)) return false
  if (typeof value.clientRequestId !== "string" || value.clientRequestId.length === 0) return false
  if (typeof value.startedAt !== "string" || value.startedAt.length === 0) return false
  if (!isMotionCopySwapActive(parseMotionCopySwapMode(value.swapMode))) return false
  if (value.status !== "ready" && value.status !== "failed") return false
  if (typeof value.swapCredits !== "number" || !Number.isFinite(value.swapCredits)) return false
  if (value.videoCredits != null && typeof value.videoCredits !== "number") return false

  if (value.status === "ready") {
    return typeof value.afterUrl === "string" && value.afterUrl.length > 0
  }

  return true
}

export function loadSwapPreviewSlots(surface: SwapPreviewSurface): MotionSwapPreviewSlot[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS[surface])
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(isPersistableSlot)
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
      .slice(0, MAX_PERSISTED_SLOTS)
  } catch {
    return []
  }
}

export function saveSwapPreviewSlots(
  surface: SwapPreviewSurface,
  slots: MotionSwapPreviewSlot[],
): void {
  if (typeof window === "undefined") return

  const persistable = slots
    .filter((slot) => slot.status === "ready" || slot.status === "failed")
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .slice(0, MAX_PERSISTED_SLOTS)

  if (persistable.length === 0) {
    window.localStorage.removeItem(STORAGE_KEYS[surface])
    return
  }

  window.localStorage.setItem(STORAGE_KEYS[surface], JSON.stringify(persistable))
}

export function resolveSwapPreviewImageUpload(
  slot: Pick<MotionSwapPreviewSlot, "characterImageUrl">,
  current: { url?: string | null } | null | undefined,
): { url: string } | null {
  if (current?.url) return { url: current.url }
  if (slot.characterImageUrl) return { url: slot.characterImageUrl }
  return null
}

export function resolveSwapPreviewVideoUpload(
  slot: Pick<MotionSwapPreviewSlot, "drivingVideoUrl">,
  current: { url?: string | null } | null | undefined,
): { url: string } | null {
  if (current?.url) return { url: current.url }
  if (slot.drivingVideoUrl) return { url: slot.drivingVideoUrl }
  return null
}
