/**
 * Shared client-side poller for async generation status endpoints.
 * Deduplicates requests per predictionId, backs off over time, and pauses in background tabs.
 */

export type GenerationPollStatus = "pending" | "completed" | "failed"

export type PollGenerationStatusOptions<T> = {
  predictionId: string
  statusEndpoint: string
  mapCompleted: (data: Record<string, unknown>) => T | null
  mapFailed: (data: Record<string, unknown>) => T
  timeoutMessage: string
  fetchErrorMessage: string
  maxAttempts?: number
  initialIntervalMs?: number
  maxIntervalMs?: number
  signal?: AbortSignal
}

const DEFAULT_MAX_ATTEMPTS = 120
const DEFAULT_INITIAL_INTERVAL_MS = 4_000
const DEFAULT_MAX_INTERVAL_MS = 30_000
const BACKOFF_FACTOR = 1.4

type PollKey = string

type SharedPollState<T> = {
  key: PollKey
  listeners: Set<(value: T) => void>
  errorListeners: Set<(message: string) => void>
  inFlight: Promise<T> | null
  lastValue: T | null
  lastError: string | null
  abortController: AbortController | null
  refCount: number
}

const sharedPolls = new Map<PollKey, SharedPollState<unknown>>()

function buildPollKey(statusEndpoint: string, predictionId: string): PollKey {
  return `${statusEndpoint}::${predictionId}`
}

function isDocumentHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden"
}

function waitForVisible(signal: AbortSignal): Promise<void> {
  if (!isDocumentHidden() || typeof document === "undefined") {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const onVisibilityChange = () => {
      if (!isDocumentHidden()) {
        document.removeEventListener("visibilitychange", onVisibilityChange)
        signal.removeEventListener("abort", onAbort)
        resolve()
      }
    }

    const onAbort = () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      resolve()
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, ms)

    const onAbort = () => {
      window.clearTimeout(timer)
      signal.removeEventListener("abort", onAbort)
      resolve()
    }

    signal.addEventListener("abort", onAbort, { once: true })
  })
}

async function runPollLoop<T>(options: PollGenerationStatusOptions<T>): Promise<T> {
  const {
    predictionId,
    statusEndpoint,
    mapCompleted,
    mapFailed,
    timeoutMessage,
    fetchErrorMessage,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    initialIntervalMs = DEFAULT_INITIAL_INTERVAL_MS,
    maxIntervalMs = DEFAULT_MAX_INTERVAL_MS,
    signal,
  } = options

  const abortSignal = signal ?? new AbortController().signal
  let intervalMs = initialIntervalMs

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (abortSignal.aborted) {
      throw new DOMException("Aborted", "AbortError")
    }

    await waitForVisible(abortSignal)
    if (abortSignal.aborted) {
      throw new DOMException("Aborted", "AbortError")
    }

    try {
      const response = await fetch(
        `${statusEndpoint}?predictionId=${encodeURIComponent(predictionId)}`,
        { cache: "no-store", signal: abortSignal },
      )

      if (!response.ok) {
        if (response.status === 401 || response.status === 403 || response.status >= 500) {
          return mapFailed({ error: fetchErrorMessage })
        }
        if (response.status === 404) {
          await sleep(intervalMs, abortSignal)
          intervalMs = Math.min(maxIntervalMs, Math.round(intervalMs * BACKOFF_FACTOR))
          continue
        }
        return mapFailed({ error: fetchErrorMessage })
      }

      const data = (await response.json()) as Record<string, unknown>

      if (data.status === "completed") {
        const completed = mapCompleted(data)
        if (completed) {
          return completed
        }
        return mapFailed({
          error: "Generation completed without usable output.",
          generationId: data.generationId,
        })
      }

      if (data.status === "failed") {
        return mapFailed(data)
      }
    } catch (error) {
      if (abortSignal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        throw error
      }
      return mapFailed({ error: fetchErrorMessage })
    }

    await sleep(intervalMs, abortSignal)
    intervalMs = Math.min(maxIntervalMs, Math.round(intervalMs * BACKOFF_FACTOR))
  }

  return mapFailed({ error: timeoutMessage })
}

function getOrCreateSharedPoll<T>(options: PollGenerationStatusOptions<T>): SharedPollState<T> {
  const key = buildPollKey(options.statusEndpoint, options.predictionId)
  const existing = sharedPolls.get(key) as SharedPollState<T> | undefined
  if (existing) {
    return existing
  }

  const created: SharedPollState<T> = {
    key,
    listeners: new Set(),
    errorListeners: new Set(),
    inFlight: null,
    lastValue: null,
    lastError: null,
    abortController: null,
    refCount: 0,
  }
  sharedPolls.set(key, created as SharedPollState<unknown>)
  return created
}

function notifyPollSuccess<T>(state: SharedPollState<T>, value: T) {
  state.lastValue = value
  state.lastError = null
  for (const listener of state.listeners) {
    listener(value)
  }
}

function notifyPollError<T>(state: SharedPollState<T>, message: string, mapFailed: (data: Record<string, unknown>) => T) {
  state.lastError = message
  const failed = mapFailed({ error: message })
  state.lastValue = failed
  for (const listener of state.errorListeners) {
    listener(message)
  }
  for (const listener of state.listeners) {
    listener(failed)
  }
}

function releaseSharedPoll<T>(state: SharedPollState<T>) {
  state.refCount = Math.max(0, state.refCount - 1)
  if (state.refCount > 0) {
    return
  }

  state.abortController?.abort()
  state.abortController = null
  state.inFlight = null
  sharedPolls.delete(state.key)
}

function ensurePollStarted<T>(state: SharedPollState<T>, options: PollGenerationStatusOptions<T>) {
  if (state.inFlight) {
    return
  }

  const abortController = new AbortController()
  state.abortController = abortController

  state.inFlight = runPollLoop({
    ...options,
    signal: abortController.signal,
  })
    .then((result) => {
      notifyPollSuccess(state, result)
      return result
    })
    .catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error
      }
      const message = error instanceof Error ? error.message : options.fetchErrorMessage
      notifyPollError(state, message, options.mapFailed)
      return options.mapFailed({ error: message })
    })
    .finally(() => {
      state.inFlight = null
      state.abortController = null
    })
}

export function subscribeGenerationStatus<T>(
  options: PollGenerationStatusOptions<T>,
  onUpdate: (value: T) => void,
): () => void {
  const state = getOrCreateSharedPoll(options)
  state.refCount += 1
  state.listeners.add(onUpdate)

  if (state.lastValue) {
    onUpdate(state.lastValue)
  } else {
    ensurePollStarted(state, options)
    void state.inFlight?.then(onUpdate).catch(() => {
      // Errors are mapped to failed poll results and delivered via onUpdate.
    })
  }

  return () => {
    state.listeners.delete(onUpdate)
    releaseSharedPoll(state)
  }
}

export async function waitForGenerationStatus<T>(
  options: PollGenerationStatusOptions<T>,
): Promise<T> {
  const state = getOrCreateSharedPoll(options)
  state.refCount += 1

  try {
    if (state.lastValue) {
      return state.lastValue
    }

    ensurePollStarted(state, options)
    return await state.inFlight!
  } finally {
    releaseSharedPoll(state)
  }
}
