import type { UIMessage } from "ai"

import type { AttachedRef } from "@/lib/commands/types"
import { refsToChatMetadata } from "@/lib/chat/reference-metadata"

export type AutomationPromptAttachment = {
  url: string
  mediaType: string
  filename?: string
}

export type AutomationPromptPayload = {
  text: string
  refs: AttachedRef[]
  attachments: AutomationPromptAttachment[]
}

function isHttpUrl(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("http://")
}

function isAttachedRefRecord(value: unknown): value is AttachedRef {
  if (!value || typeof value !== "object") return false
  const o = value as Record<string, unknown>
  return (
    typeof o.id === "string" &&
    typeof o.label === "string" &&
    (o.category === "brand" || o.category === "asset") &&
    typeof o.chipId === "string" &&
    typeof o.mentionToken === "string" &&
    typeof o.serialized === "string"
  )
}

function parseRefs(raw: unknown): AttachedRef[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isAttachedRefRecord)
}

function parseAttachments(raw: unknown): AutomationPromptAttachment[] {
  if (!Array.isArray(raw)) return []
  const out: AutomationPromptAttachment[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const url = typeof o.url === "string" ? o.url.trim() : ""
    const mediaType = typeof o.mediaType === "string" ? o.mediaType.trim() : ""
    if (!url || !mediaType || !isHttpUrl(url)) continue
    const filename = typeof o.filename === "string" ? o.filename : undefined
    out.push({ url, mediaType, ...(filename ? { filename } : {}) })
  }
  return out
}

/**
 * Normalizes API/DB JSON into a strict payload. Falls back to plain `prompt` text when payload is missing.
 */
export function normalizeAutomationPromptPayload(
  prompt: string,
  rawPayload: unknown,
): AutomationPromptPayload {
  const fallbackText = typeof prompt === "string" ? prompt.trim() : ""

  if (!rawPayload || typeof rawPayload !== "object") {
    return { text: fallbackText, refs: [], attachments: [] }
  }

  const o = rawPayload as Record<string, unknown>
  const text = typeof o.text === "string" ? o.text.trim() : ""
  return {
    text: text.length > 0 ? text : fallbackText,
    refs: parseRefs(o.refs),
    attachments: parseAttachments(o.attachments),
  }
}

export function buildAutomationUserMessage(
  payload: AutomationPromptPayload,
  genId: () => string,
): UIMessage {
  const parts: UIMessage["parts"] = []

  for (const a of payload.attachments) {
    parts.push({
      type: "file",
      url: a.url,
      mediaType: a.mediaType,
      ...(a.filename ? { filename: a.filename } : {}),
    })
  }

  parts.push({ type: "text", text: payload.text })

  const metadata = payload.refs.length > 0 ? refsToChatMetadata(payload.refs) : undefined

  return {
    id: genId(),
    role: "user",
    parts,
    ...(metadata ? { metadata } : {}),
  }
}

export function parsePromptPayloadFromRequestBody(body: Record<string, unknown>): AutomationPromptPayload {
  const explicit = body.promptPayload
  if (explicit && typeof explicit === "object") {
    const o = explicit as Record<string, unknown>
    const text = typeof o.text === "string" ? o.text.trim() : ""
    return {
      text,
      refs: parseRefs(o.refs),
      attachments: parseAttachments(o.attachments),
    }
  }

  const legacy = typeof body.prompt === "string" ? body.prompt.trim() : ""
  return { text: legacy, refs: [], attachments: [] }
}

export function automationPayloadToRowFields(payload: AutomationPromptPayload): {
  prompt: string
  prompt_payload: AutomationPromptPayload
} {
  return {
    prompt: payload.text,
    prompt_payload: {
      text: payload.text,
      refs: payload.refs,
      attachments: payload.attachments,
    },
  }
}
