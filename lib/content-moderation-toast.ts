import { toast } from "sonner"
import {
  isContentModerationError,
  isContentModerationMessage,
} from "@/lib/generate-image-client"

export const CONTENT_MODERATION_USER_MESSAGE =
  "Blocked by model safety filters. No credits were used. Try adjusting your prompt."

const DEFAULT_USER_FACING_ERROR = "Something went wrong. Please try again."

const TOAST_TITLE = "Blocked by safety filters"
const TOAST_DESCRIPTION = "No credits were used. Try adjusting your prompt."

type ContentModerationToastOptions = {
  toastId?: string
}

function isUserFacingModerationMessage(message: string): boolean {
  return message.trim() === CONTENT_MODERATION_USER_MESSAGE
}

/** Provider / stack / HTTP details that should never appear in user-facing UI. */
function looksLikeTechnicalError(message: string): boolean {
  const m = message.trim()
  if (!m) return true
  if (/https?:\/\//i.test(m)) return true
  if (/failed with status\s*\d{3}/i.test(m)) return true
  if (/\b(api\.replicate\.com|replicate\.com\/v1|ECONNREFUSED|ENOTFOUND|ETIMEDOUT)\b/i.test(m)) {
    return true
  }
  if (/\b(TypeError|ReferenceError|SyntaxError|AggregateError)\b/.test(m)) return true
  if (/\b(REPLICATE_|FAL_|OPENAI_|SUPABASE_|process\.env)\b/.test(m)) return true
  if (/environment variable/i.test(m)) return true
  if (/^\s*\{[\s\S]*"detail"[\s\S]*\}\s*$/.test(m)) return true
  if (/at\s+\S+\s+\([^)]+:\d+:\d+\)/.test(m)) return true
  return false
}

/**
 * Replace provider/API / moderation / technical text with a safe user-facing message.
 * Pass `fallback` when a more specific product message is preferred (e.g. remove-bg).
 */
export function toUserFacingGenerationError(
  message: string,
  fallback: string = DEFAULT_USER_FACING_ERROR,
): string {
  if (isUserFacingModerationMessage(message) || isContentModerationMessage(message)) {
    return CONTENT_MODERATION_USER_MESSAGE
  }
  if (looksLikeTechnicalError(message)) {
    return fallback
  }
  return message
}

/** Fixed user-facing toast — never echo provider / API error text. */
export function showContentModerationToast(options?: ContentModerationToastOptions) {
  toast.error(TOAST_TITLE, {
    id: options?.toastId ?? "content-moderation-error",
    description: TOAST_DESCRIPTION,
  })
}

/**
 * If the error looks like content moderation, show the user-facing toast and return true.
 * Otherwise return false so the caller can handle other errors.
 */
export function tryShowContentModerationToast(
  message: string,
  err?: unknown,
  options?: ContentModerationToastOptions,
): boolean {
  const isModeration =
    isUserFacingModerationMessage(message) ||
    (err !== undefined && isContentModerationError(err)) ||
    isContentModerationMessage(message)

  if (!isModeration) return false

  showContentModerationToast(options)
  return true
}
