export const MAX_WAVESPEED_LORAS = 3
export const WAVESPEED_LORA_SCALE_MIN = 0
export const WAVESPEED_LORA_SCALE_MAX = 4
export const WAVESPEED_LORA_SCALE_DEFAULT = 1

export type WaveSpeedLoraSlot = {
  id: string
  path: string
  scale: number
}

export type WaveSpeedLoraPayload = {
  path: string
  scale: number
}

const STORAGE_KEY = "unican-qwen-image-21-loras"

function newSlotId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `lora-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createEmptyWaveSpeedLoraSlot(): WaveSpeedLoraSlot {
  return { id: newSlotId(), path: "", scale: WAVESPEED_LORA_SCALE_DEFAULT }
}

function clampScale(value: unknown): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN
  if (!Number.isFinite(parsed)) return WAVESPEED_LORA_SCALE_DEFAULT
  return Math.min(WAVESPEED_LORA_SCALE_MAX, Math.max(WAVESPEED_LORA_SCALE_MIN, parsed))
}

export function loadWaveSpeedLoraSlots(): WaveSpeedLoraSlot[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const slots: WaveSpeedLoraSlot[] = []
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue
      const record = item as Record<string, unknown>
      const path = typeof record.path === "string" ? record.path : ""
      const id = typeof record.id === "string" && record.id.trim() ? record.id : newSlotId()
      slots.push({ id, path, scale: clampScale(record.scale) })
      if (slots.length >= MAX_WAVESPEED_LORAS) break
    }
    return slots
  } catch {
    return []
  }
}

export function saveWaveSpeedLoraSlots(slots: WaveSpeedLoraSlot[]): void {
  if (typeof window === "undefined") return
  const trimmed = slots.slice(0, MAX_WAVESPEED_LORAS).map((slot) => ({
    id: slot.id,
    path: slot.path,
    scale: clampScale(slot.scale),
  }))
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
}

export function countActiveWaveSpeedLoras(slots: WaveSpeedLoraSlot[]): number {
  return slots.filter((slot) => slot.path.trim().length > 0).length
}

export function waveSpeedLoraSlotsToPayload(slots: WaveSpeedLoraSlot[]): WaveSpeedLoraPayload[] {
  const payloads: WaveSpeedLoraPayload[] = []
  for (const slot of slots) {
    const path = slot.path.trim()
    if (!path) continue
    payloads.push({ path, scale: clampScale(slot.scale) })
    if (payloads.length >= MAX_WAVESPEED_LORAS) break
  }
  return payloads
}

export function parseWaveSpeedLorasFormValue(raw: unknown): WaveSpeedLoraPayload[] {
  if (typeof raw !== "string" || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return waveSpeedLoraSlotsToPayload(
      parsed.map((item, index) => {
        if (!item || typeof item !== "object") {
          return { id: `parsed-${index}`, path: "", scale: WAVESPEED_LORA_SCALE_DEFAULT }
        }
        const record = item as Record<string, unknown>
        return {
          id: `parsed-${index}`,
          path: typeof record.path === "string" ? record.path : "",
          scale: clampScale(record.scale),
        }
      }),
    )
  } catch {
    return []
  }
}
