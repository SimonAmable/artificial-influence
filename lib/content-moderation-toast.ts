import { toast } from "sonner"
import {
  isContentModerationError,
  isContentModerationMessage,
} from "@/lib/generate-image-client"

export const CONTENT_MODERATION_USER_MESSAGE =
  "Blocked by model safety filters. No credits were used. Try adjusting your prompt."

const TOAST_TITLE = "Blocked by safety filters"
const TOAST_DESCRIPTION = "No credits were used. Try adjusting your prompt."

type ContentModerationToastOptions = {
  toastId?: string
}

function isUserFacingModerationMessage(message: string): boolean {
  return message.trim() === CONTENT_MODERATION_USER_MESSAGE
}

/** Replace provider/API moderation text with a fixed user-facing explanation. */
export function toUserFacingGenerationError(message: string): string {
  if (isUserFacingModerationMessage(message) || isContentModerationMessage(message)) {
    return CONTENT_MODERATION_USER_MESSAGE
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
