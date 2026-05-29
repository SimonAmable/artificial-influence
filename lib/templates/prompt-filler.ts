import type { UIMessage } from "ai"
import type {
  Template,
  TemplateHiddenContext,
  TemplateInput,
} from "@/lib/templates/types"
import { getDefaultInputValue, isMediaInputKind } from "@/lib/templates/validation"

export type TemplateInputValues = Record<string, unknown>

export interface FilledTemplatePrompt {
  text: string
  imageUrls: string[]
  videoUrls: string[]
  audioUrls: string[]
}

interface FillTemplatePromptOptions {
  additionalImageUrls?: string[]
}

interface BuildTemplateHiddenContextOptions {
  promptImageCountsByInputId?: Record<string, number>
}

interface BuildTemplateOpeningMessageOptions {
  hiddenImageUrls?: string[]
}

const TEMPLATE_HIDDEN_CONTEXT_PREFIX = "<template_context hidden=\"true\">"
const TEMPLATE_HIDDEN_CONTEXT_SUFFIX = "</template_context>"
const TEMPLATE_HIDDEN_MEDIA_FILENAME_PREFIX = "__template_hidden__"

function stringifyScalar(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "boolean") return value ? "yes" : "no"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") return value
  return String(value)
}

function resolveScalarValue(input: TemplateInput, values: TemplateInputValues): string {
  const raw = values[input.id]
  if (raw !== undefined && raw !== null && raw !== "") {
    return stringifyScalar(raw)
  }
  const fallback = getDefaultInputValue(input)
  return stringifyScalar(fallback)
}

export function fillTemplatePrompt(
  template: Pick<Template, "prompt" | "inputs">,
  values: TemplateInputValues,
  options?: FillTemplatePromptOptions,
): FilledTemplatePrompt {
  const imageUrls: string[] = []
  const videoUrls: string[] = []
  const audioUrls: string[] = []

  for (const input of template.inputs) {
    if (!isMediaInputKind(input.kind)) continue
    const url = values[input.id]
    if (typeof url !== "string" || url.trim().length === 0) continue

    if (input.kind === "image") imageUrls.push(url.trim())
    if (input.kind === "video") videoUrls.push(url.trim())
    if (input.kind === "audio") audioUrls.push(url.trim())
  }

  for (const url of options?.additionalImageUrls ?? []) {
    const trimmed = url.trim()
    if (trimmed.length > 0) {
      imageUrls.push(trimmed)
    }
  }

  let text = template.prompt
  for (const input of template.inputs) {
    if (isMediaInputKind(input.kind)) {
      text = text.replaceAll(`{{${input.id}}}`, "").replace(/\s{2,}/g, " ").trim()
      continue
    }
    const replacement = resolveScalarValue(input, values)
    text = text.replaceAll(`{{${input.id}}}`, replacement)
  }

  return {
    text: text.trim(),
    imageUrls: [...new Set(imageUrls)],
    videoUrls: [...new Set(videoUrls)],
    audioUrls: [...new Set(audioUrls)],
  }
}

export function buildTemplateHiddenContext(
  template: Pick<Template, "title" | "slug" | "prompt" | "output_kind" | "inputs">,
  values: TemplateInputValues,
  filled: FilledTemplatePrompt,
  options?: BuildTemplateHiddenContextOptions,
): TemplateHiddenContext {
  const fieldSummaries = template.inputs.map((input) => {
    if (isMediaInputKind(input.kind)) {
      const raw = values[input.id]
      const hasAttachment = typeof raw === "string" && raw.trim().length > 0

      return {
        id: input.id,
        kind: input.kind,
        label: input.label,
        value: hasAttachment ? "attached" : "not provided",
      }
    }

    const resolvedValue = resolveScalarValue(input, values)
    const promptImageCount = options?.promptImageCountsByInputId?.[input.id] ?? 0
    const promptImageNote =
      promptImageCount > 0
        ? ` (+${promptImageCount} reference image${promptImageCount === 1 ? "" : "s"} attached)`
        : ""

    return {
      id: input.id,
      kind: input.kind,
      label: input.label,
      value: `${resolvedValue || "(empty)"}${promptImageNote}`,
    }
  })

  return {
    templateTitle: template.title,
    templateSlug: template.slug,
    outputKind: template.output_kind,
    rawPrompt: template.prompt.trim(),
    filledPrompt: filled.text,
    fieldSummaries,
    imageUrls: filled.imageUrls,
    videoUrls: filled.videoUrls,
    audioUrls: filled.audioUrls,
  }
}

export function renderTemplateHiddenContext(context: TemplateHiddenContext): string {
  const fieldLines =
    context.fieldSummaries.length > 0
      ? context.fieldSummaries
          .map((field) => `- ${field.label} (${field.kind}): ${field.value}`)
          .join("\n")
      : "- none"

  const mediaLines = [
    `Images attached: ${context.imageUrls.length}`,
    `Videos attached: ${context.videoUrls.length}`,
    `Audio files attached: ${context.audioUrls.length}`,
  ].join("\n")

  return [
    `Template title: ${context.templateTitle}`,
    `Template slug: ${context.templateSlug}`,
    `Requested output: ${context.outputKind}`,
    "",
    "Filled template prompt:",
    context.filledPrompt || "(empty)",
    "",
    "Original template prompt:",
    context.rawPrompt || "(empty)",
    "",
    "Structured inputs:",
    fieldLines,
    "",
     "Attached media summary:",
     mediaLines,
     "",
     "Execution guidance:",
     "Treat the filled template prompt as the actual requested task even if the visible user message is brief. Use the attached files as the template inputs.",
     "Inspect image files attached in this opening message directly with native multimodal understanding. Do not use a separate media-analysis step for those current-turn attachments unless the image cannot actually be seen.",
     "If the task asks for a detailed recreate prompt or JSON package, build it directly from the attached image rather than outsourcing first-pass perception to a media-analysis tool.",
   ].join("\n")
}

export function serializeTemplateHiddenContextText(context: TemplateHiddenContext): string {
  return [
    TEMPLATE_HIDDEN_CONTEXT_PREFIX,
    renderTemplateHiddenContext(context),
    TEMPLATE_HIDDEN_CONTEXT_SUFFIX,
  ].join("\n")
}

export function isTemplateHiddenContextText(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.startsWith(TEMPLATE_HIDDEN_CONTEXT_PREFIX)
    && trimmed.endsWith(TEMPLATE_HIDDEN_CONTEXT_SUFFIX)
}

export function isTemplateHiddenMediaFilename(filename: string | undefined): boolean {
  return typeof filename === "string" && filename.startsWith(TEMPLATE_HIDDEN_MEDIA_FILENAME_PREFIX)
}

function mediaTypeForUrl(url: string, kind: "image" | "video" | "audio"): string {
  const lower = url.toLowerCase()
  if (kind === "image") {
    if (lower.endsWith(".png")) return "image/png"
    if (lower.endsWith(".webp")) return "image/webp"
    if (lower.endsWith(".gif")) return "image/gif"
    return "image/jpeg"
  }
  if (kind === "video") {
    if (lower.endsWith(".webm")) return "video/webm"
    return "video/mp4"
  }
  if (lower.endsWith(".wav")) return "audio/wav"
  return "audio/mpeg"
}

export function buildTemplateOpeningMessage(
  filled: FilledTemplatePrompt,
  templateTitle: string,
  templateContext: TemplateHiddenContext,
  options?: BuildTemplateOpeningMessageOptions,
): UIMessage {
  const parts: UIMessage["parts"] = []
  const hiddenImageUrls = new Set(options?.hiddenImageUrls ?? [])
  parts.push({ type: "text", text: `Help me with the "${templateTitle}" template.` })

  for (const url of filled.imageUrls) {
    const isHidden = hiddenImageUrls.has(url)
    parts.push({
      type: "file",
      url,
      mediaType: mediaTypeForUrl(url, "image"),
      filename: isHidden
        ? `${TEMPLATE_HIDDEN_MEDIA_FILENAME_PREFIX}reference-image`
        : "reference-image",
    })
  }

  for (const url of filled.videoUrls) {
    parts.push({
      type: "file",
      url,
      mediaType: mediaTypeForUrl(url, "video"),
      filename: "reference-video",
    })
  }

  for (const url of filled.audioUrls) {
    parts.push({
      type: "file",
      url,
      mediaType: mediaTypeForUrl(url, "audio"),
      filename: "reference-audio",
    })
  }

  parts.push({
    type: "text",
    text: serializeTemplateHiddenContextText(templateContext),
  })

  return {
    id: `template-${Date.now()}`,
    role: "user",
    parts,
  }
}
