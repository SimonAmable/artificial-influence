import { ApiError, ValidationError, fal } from "@fal-ai/client"

type FalDetailItem = {
  loc?: unknown[]
  msg?: string
  type?: string
}

function formatFalDetailItems(detail: unknown): string | null {
  if (!Array.isArray(detail) || detail.length === 0) {
    return null
  }

  const messages = detail
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const entry = item as FalDetailItem
      const msg = typeof entry.msg === "string" ? entry.msg.trim() : ""
      if (!msg) return null

      if (entry.type === "content_policy_violation") {
        return msg
      }

      const loc = Array.isArray(entry.loc)
        ? entry.loc
            .map((part) => (typeof part === "string" || typeof part === "number" ? String(part) : ""))
            .filter(Boolean)
            .join(".")
        : ""
      return loc ? `${loc}: ${msg}` : msg
    })
    .filter((value): value is string => Boolean(value))

  return messages.length > 0 ? messages.join("; ") : null
}

function formatFalErrorBody(body: Record<string, unknown> | undefined): string | null {
  if (!body || typeof body !== "object") {
    return null
  }

  const detailMessage = formatFalDetailItems(body.detail)
  if (detailMessage) return detailMessage

  if (typeof body.detail === "string" && body.detail.trim()) {
    return body.detail.trim()
  }
  if (typeof body.message === "string" && body.message.trim()) {
    return body.message.trim()
  }
  if (typeof body.error === "string" && body.error.trim()) {
    return body.error.trim()
  }

  return null
}

/**
 * Turn @fal-ai/client errors into a user-visible string.
 * Body message is often missing for HTTP 422 — use Pydantic-style field errors when present.
 */
export function formatFalClientError(error: unknown): string {
  if (error instanceof ValidationError) {
    const fe = error.fieldErrors
    if (Array.isArray(fe) && fe.length > 0) {
      return fe.map((e) => `${e.loc.join(".")}: ${e.msg}`).join("; ")
    }
    const body = error.body as Record<string, unknown> | undefined
    const formatted = formatFalErrorBody(body)
    if (formatted) return formatted
  }

  if (error instanceof ApiError) {
    const formatted = formatFalErrorBody(error.body as Record<string, unknown> | undefined)
    if (formatted) return formatted

    if (typeof error.message === "string" && error.message !== "Unprocessable Entity") {
      return error.message
    }
    if (typeof error.status === "number") {
      return `Fal API error (${error.status}).`
    }
  }

  if (error && typeof error === "object" && "body" in error) {
    const formatted = formatFalErrorBody(
      (error as { body?: Record<string, unknown> }).body,
    )
    if (formatted) return formatted
  }

  return error instanceof Error ? error.message : String(error)
}

const GENERIC_FAL_WEBHOOK_ERRORS = new Set([
  "fal generation failed",
  "unexpected status code: 422",
  "unprocessable entity",
])

function isGenericFalWebhookError(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  if (!normalized) return true
  return GENERIC_FAL_WEBHOOK_ERRORS.has(normalized)
}

/**
 * Fal webhooks often return a generic `Unexpected status code: 422` message.
 * Fetch the queue result to recover structured validation / moderation errors.
 */
export async function resolveFalWebhookFailureMessage(
  endpointId: string,
  requestId: string,
  fallbackMessage: string,
): Promise<string> {
  const fallback = fallbackMessage.trim() || "Fal generation failed"
  if (!isGenericFalWebhookError(fallback)) {
    return fallback
  }

  try {
    const key = process.env.FAL_KEY
    if (!key) {
      return fallback
    }
    fal.config({ credentials: key })
    await fal.queue.result(endpointId, { requestId })
    return fallback
  } catch (error) {
    const formatted = formatFalClientError(error).trim()
    return formatted || fallback
  }
}
