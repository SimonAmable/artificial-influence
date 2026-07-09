import { FANVUE_API_BASE_URL, FANVUE_API_VERSION } from "@/lib/fanvue/config"

export class FanvueApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status = 500, code?: string) {
    super(message)
    this.name = "FanvueApiError"
    this.status = status
    this.code = code
  }
}

type FanvueRequestOptions = {
  accessToken: string
  method?: string
  path: string
  body?: unknown
  searchParams?: Record<string, string | number | undefined | null>
}

function buildFanvueApiUrl(options: FanvueRequestOptions): URL {
  const url = new URL(options.path.replace(/^\//, ""), `${FANVUE_API_BASE_URL}/`)
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url
}

function throwFanvueApiError(text: string, status: number): never {
  let record: Record<string, unknown> = {}
  if (text) {
    try {
      const parsed = JSON.parse(text) as unknown
      if (parsed && typeof parsed === "object") {
        record = parsed as Record<string, unknown>
      }
    } catch {
      // Fanvue may return plain-text error bodies on some endpoints.
    }
  }

  const errors = Array.isArray(record.errors) ? record.errors.map(String).join(", ") : null
  const message =
    (typeof record.error === "string" && record.error) ||
    errors ||
    (typeof record.message === "string" && record.message) ||
    (text.trim() || `Fanvue API request failed (${status}).`)
  throw new FanvueApiError(message, status)
}

async function fanvueApiFetch(options: FanvueRequestOptions): Promise<Response> {
  return fetch(buildFanvueApiUrl(options), {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
      "X-Fanvue-API-Version": FANVUE_API_VERSION,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
}

export async function fanvueApiRequest<T>(options: FanvueRequestOptions): Promise<T> {
  const response = await fanvueApiFetch(options)
  const text = await response.text()
  let json: unknown = null
  if (text) {
    try {
      json = JSON.parse(text) as unknown
    } catch {
      json = { raw: text }
    }
  }

  if (!response.ok) {
    throwFanvueApiError(text, response.status)
  }

  return json as T
}

export async function fanvueApiRequestText(options: FanvueRequestOptions): Promise<string> {
  const response = await fanvueApiFetch(options)
  const text = await response.text()

  if (!response.ok) {
    throwFanvueApiError(text, response.status)
  }

  return text.trim()
}

export async function fanvueApiUploadPart(url: string, body: Buffer): Promise<string> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: new Uint8Array(body),
  })

  if (!response.ok) {
    throw new FanvueApiError(`Fanvue media part upload failed (${response.status}).`, response.status)
  }

  const etag = response.headers.get("etag") ?? response.headers.get("ETag")
  if (!etag?.trim()) {
    throw new FanvueApiError("Fanvue media part upload did not return an ETag.", 500)
  }

  return etag.trim()
}
