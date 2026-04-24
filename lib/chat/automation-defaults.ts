import type { UIMessage } from "ai"

import type { AutomationPromptAttachment } from "@/lib/automations/prompt-payload"
import { getSelectedReferencesFromMessage } from "@/lib/chat/reference-metadata"
import type { AttachedRef } from "@/lib/commands/types"

function buildSerializedRefLabel(ref: {
  assetType?: string
  assetUrl?: string
  category: "brand" | "asset"
  id: string
  label: string
}) {
  if (ref.category === "brand") {
    return `Brand "${ref.label}"`
  }
  if (ref.assetUrl) {
    return `Reference (${ref.assetType ?? "asset"}) "${ref.label}": ${ref.assetUrl}`
  }
  return `Reference "${ref.label}"`
}

export function getAutomationDefaultsFromMessages(messages: UIMessage[]): {
  attachments: AutomationPromptAttachment[]
  refs: AttachedRef[]
} {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")
  if (!latestUserMessage) {
    return { attachments: [], refs: [] }
  }

  const refs: AttachedRef[] = getSelectedReferencesFromMessage(latestUserMessage).map((ref, index) => ({
    id: ref.id,
    label: ref.label,
    category: ref.category,
    assetType: ref.assetType,
    assetUrl: ref.assetUrl,
    previewUrl: ref.previewUrl ?? null,
    chipId: `${ref.id}:${index}`,
    mentionToken: ref.category === "brand" ? `@${ref.label}` : ref.label,
    serialized: buildSerializedRefLabel(ref),
  }))

  const attachments: AutomationPromptAttachment[] = latestUserMessage.parts
    .filter((part): part is Extract<UIMessage["parts"][number], { type: "file" }> => part.type === "file")
    .map((part) => ({
      url: part.url,
      mediaType: part.mediaType ?? "application/octet-stream",
      ...(part.filename ? { filename: part.filename } : {}),
    }))

  return { attachments, refs }
}
