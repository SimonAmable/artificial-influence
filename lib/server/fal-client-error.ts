import { ApiError, ValidationError } from "@fal-ai/client"

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
    const body = error.body as { detail?: unknown; message?: unknown } | undefined
    if (body && typeof body.detail === "string" && body.detail.trim()) {
      return body.detail.trim()
    }
  }
  if (error instanceof ApiError) {
    const body = error.body as Record<string, unknown> | undefined
    if (body && typeof body === "object") {
      if (typeof body.detail === "string" && body.detail.trim()) return body.detail.trim()
      if (typeof body.message === "string" && body.message.trim()) return body.message.trim()
      if (typeof body.error === "string" && body.error.trim()) return body.error.trim()
    }
    if (typeof error.message === "string" && error.message !== "Unprocessable Entity") {
      return error.message
    }
    if (typeof error.status === "number") {
      return `Fal API error (${error.status}).`
    }
  }
  return error instanceof Error ? error.message : String(error)
}
