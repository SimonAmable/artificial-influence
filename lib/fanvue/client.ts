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

export async function fanvueApiRequest<T>(options: FanvueRequestOptions): Promise<T> {
  const url = new URL(options.path.replace(/^\//, ""), `${FANVUE_API_BASE_URL}/`)
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const response = await fetch(url, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
      "X-Fanvue-API-Version": FANVUE_API_VERSION,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

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
    const record = json && typeof json === "object" ? (json as Record<string, unknown>) : {}
    const errors = Array.isArray(record.errors) ? record.errors.map(String).join(", ") : null
    const message =
      (typeof record.error === "string" && record.error) ||
      errors ||
      (typeof record.message === "string" && record.message) ||
      `Fanvue API request failed (${response.status}).`
    throw new FanvueApiError(message, response.status)
  }

  return json as T
}

export async function fanvueApiUploadPart(url: string, body: Buffer, contentType = "application/octet-stream") {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(body),
  })

  if (!response.ok) {
    throw new FanvueApiError(`Fanvue media part upload failed (${response.status}).`, response.status)
  }
}
