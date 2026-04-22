import type { UIMessage } from "ai"

import type { AttachedRef } from "@/lib/commands/types"
import { refsToChatMetadata } from "@/lib/chat/reference-metadata"

export type AutomationPromptAttachment = {
  url: string
  mediaType: string
  filename?: string
}

export type AutomationPromptVariableItem =
  | { kind: "text"; value: string }
  | { kind: "attachment"; url: string; mediaType: string; filename?: string }
  | { kind: "ref"; ref: AttachedRef }

export type AutomationPromptVariable = {
  id: string
  name: string
  mode: "random" | "sequential"
  cursor?: number
  items: AutomationPromptVariableItem[]
}

export type AutomationPromptPayload = {
  text: string
  refs: AttachedRef[]
  attachments: AutomationPromptAttachment[]
  variables?: AutomationPromptVariable[]
}

function mediaTypeFromAssetType(assetType: AttachedRef["assetType"]): string {
  if (assetType === "image") return "image/*"
  if (assetType === "video") return "video/*"
  if (assetType === "audio") return "audio/*"
  return "application/octet-stream"
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

function parseVariableItem(raw: unknown): AutomationPromptVariableItem | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const kind = o.kind
  if (kind === "text") {
    const value = typeof o.value === "string" ? o.value : ""
    return { kind: "text", value }
  }
  if (kind === "attachment") {
    const url = typeof o.url === "string" ? o.url.trim() : ""
    const mediaType = typeof o.mediaType === "string" ? o.mediaType.trim() : ""
    if (!url || !mediaType || !isHttpUrl(url)) return null
    const filename = typeof o.filename === "string" ? o.filename : undefined
    return { kind: "attachment", url, mediaType, ...(filename ? { filename } : {}) }
  }
  if (kind === "ref") {
    const ref = o.ref
    if (!isAttachedRefRecord(ref)) return null
    return { kind: "ref", ref }
  }
  return null
}

function parseVariables(raw: unknown): AutomationPromptVariable[] {
  if (!Array.isArray(raw)) return []
  const out: AutomationPromptVariable[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const id = typeof o.id === "string" ? o.id.trim() : ""
    const name = typeof o.name === "string" ? o.name.trim() : ""
    if (!id || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id)) continue
    const mode = o.mode === "sequential" ? "sequential" : o.mode === "random" ? "random" : null
    if (!mode) continue
    const itemsRaw = Array.isArray(o.items) ? o.items : []
    const items: AutomationPromptVariableItem[] = []
    for (const it of itemsRaw) {
      const parsed = parseVariableItem(it)
      if (parsed) items.push(parsed)
    }
    let cursor: number | undefined
    if (typeof o.cursor === "number" && Number.isFinite(o.cursor) && o.cursor >= 0) {
      cursor = Math.floor(o.cursor)
    }
    out.push({ id, name: name || id, mode, items, ...(cursor !== undefined ? { cursor } : {}) })
  }
  return out
}

/** Drops empty / invalid variable items before save. */
export function sanitizeAutomationVariables(
  vars: AutomationPromptVariable[],
): AutomationPromptVariable[] {
  return vars
    .map((v) => ({
      ...v,
      items: v.items.filter((it) => {
        if (it.kind === "text") return it.value.trim().length > 0
        if (it.kind === "attachment") {
          return (
            it.url.length > 0 &&
            it.mediaType.length > 0 &&
            (it.url.startsWith("https://") || it.url.startsWith("http://"))
          )
        }
        if (it.kind === "ref") return it.ref.mentionToken.length > 0 && it.ref.id.length > 0
        return false
      }),
    }))
    .filter((v) => v.items.length > 0)
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
  const variables = parseVariables(o.variables)
  return {
    text: text.length > 0 ? text : fallbackText,
    refs: parseRefs(o.refs),
    attachments: parseAttachments(o.attachments),
    ...(variables.length > 0 ? { variables } : {}),
  }
}

export function buildAutomationUserMessage(
  payload: AutomationPromptPayload,
  genId: () => string,
): UIMessage {
  const parts: UIMessage["parts"] = []
  const attachedAssetUrls = new Set(payload.attachments.map((attachment) => attachment.url))

  for (const ref of payload.refs) {
    if (ref.category !== "asset" || !ref.assetUrl || !ref.assetType) {
      continue
    }
    if (attachedAssetUrls.has(ref.assetUrl)) {
      continue
    }
    parts.push({
      type: "file",
      url: ref.assetUrl,
      mediaType: mediaTypeFromAssetType(ref.assetType),
      filename: ref.label || undefined,
    })
  }

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
    const variables = parseVariables(o.variables)
    return {
      text,
      refs: parseRefs(o.refs),
      attachments: parseAttachments(o.attachments),
      ...(variables.length > 0 ? { variables } : {}),
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
      ...(payload.variables && payload.variables.length > 0
        ? { variables: payload.variables }
        : {}),
    },
  }
}
