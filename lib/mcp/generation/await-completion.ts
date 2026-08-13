import "server-only"

import { completeFalPendingImageAdmin } from "@/lib/server/fal-image-completion"
import { completeFalPendingVideoAdmin } from "@/lib/server/fal-video-completion"

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled", "canceled", "error"])
const PENDING_STATUSES = new Set(["pending", "queued", "processing", "starting", "in_progress"])

const DEFAULT_TIMEOUT_MS = 90_000
const DEFAULT_POLL_INTERVAL_MS = 2_000

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export type GenerationAwaitSnapshot = {
  status: string | null
  predictionId: string | null
  type: string | null
}

export async function awaitGenerationSnapshot<T extends GenerationAwaitSnapshot>(options: {
  getSnapshot: () => Promise<T>
  timeoutMs?: number
  pollIntervalMs?: number
}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const deadline = Date.now() + timeoutMs

  let snapshot = await options.getSnapshot()
  let status = normalizeStatus(snapshot.status)

  while (!TERMINAL_STATUSES.has(status) && Date.now() < deadline) {
    if (PENDING_STATUSES.has(status) && snapshot.predictionId) {
      if (snapshot.type === "video") {
        await completeFalPendingVideoAdmin(snapshot.predictionId)
      } else if (snapshot.type === "image") {
        await completeFalPendingImageAdmin(snapshot.predictionId)
      }
    }

    await sleep(pollIntervalMs)
    snapshot = await options.getSnapshot()
    status = normalizeStatus(snapshot.status)
  }

  return snapshot
}

function normalizeStatus(status: string | null) {
  return typeof status === "string" ? status.toLowerCase() : "pending"
}
