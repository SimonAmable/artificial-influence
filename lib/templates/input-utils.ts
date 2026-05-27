import type { AspectRatioPreset, TemplateInput, TemplateInputKind } from "@/lib/templates/types"

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

export type DraftTemplateInput = DistributiveOmit<TemplateInput, "id"> & { id?: string }

export const ASPECT_RATIO_PRESETS: { value: AspectRatioPreset; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "9:16", label: "Vertical (9:16)" },
  { value: "1:1", label: "Square (1:1)" },
  { value: "16:9", label: "Horizontal (16:9)" },
]

export const INPUT_KIND_LABELS: Record<TemplateInputKind, string> = {
  image: "Photo upload",
  video: "Video upload",
  audio: "Audio upload",
  text: "Text",
  boolean: "Yes / No",
  aspect_ratio: "Aspect ratio",
}

export function labelToFieldId(label: string, used: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/(^_+|_+$)/g, "")
      .slice(0, 48) || "field"

  let id = base
  let suffix = 2
  while (used.has(id)) {
    id = `${base}_${suffix}`
    suffix += 1
  }
  used.add(id)
  return id
}

function sanitizeTemplateFieldId(id: string): string | null {
  const normalized =
    id
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/(^_+|_+$)/g, "")
      .slice(0, 48)

  if (!normalized) return null
  if (!/^[a-z][a-z0-9_]*$/.test(normalized)) return null
  return normalized
}

export function assignInputIds(inputs: DraftTemplateInput[]): TemplateInput[] {
  const used = new Set<string>()
  return inputs.map((input) => {
    const preferredId =
      typeof input.id === "string" ? sanitizeTemplateFieldId(input.id) : null

    const id =
      preferredId && !used.has(preferredId)
        ? (used.add(preferredId), preferredId)
        : labelToFieldId(input.label, used)

    return {
      ...input,
      id,
    }
  }) as TemplateInput[]
}

export function createDefaultInput(kind: TemplateInputKind, label?: string): DraftTemplateInput {
  switch (kind) {
    case "image":
      return {
        kind,
        label: label ?? "Your photo",
        required: true,
        helpText: "Upload a clear photo",
      }
    case "video":
      return { kind, label: label ?? "Reference video", required: false }
    case "audio":
      return { kind, label: label ?? "Reference audio", required: false }
    case "text":
      return {
        kind,
        label: label ?? "Extra details",
        required: false,
        placeholder: "Optional",
        multiline: true,
      }
    case "boolean":
      return { kind, label: label ?? "Enable option", required: false, default: false }
    case "aspect_ratio":
      return {
        kind,
        label: label ?? "Format",
        required: false,
        default: "9:16",
      }
  }
}

/** Map stored / legacy input shapes to the simplified runtime model. */
export function normalizeTemplateInput(raw: unknown): TemplateInput | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Record<string, unknown>
  const kind = item.kind
  const label = typeof item.label === "string" ? item.label : "Field"
  const id = typeof item.id === "string" ? item.id : labelToFieldId(label, new Set())
  const required = Boolean(item.required)

  if (kind === "image" || kind === "video" || kind === "audio") {
    const tips = typeof item.tips === "string" ? item.tips : undefined
    return {
      kind,
      id,
      label,
      required,
      ...(tips || item.helpText ? { helpText: tips ?? String(item.helpText) } : {}),
    }
  }

  if (kind === "text" || kind === "long_text") {
    return {
      kind: "text",
      id,
      label,
      required,
      placeholder: typeof item.placeholder === "string" ? item.placeholder : undefined,
      multiline: kind === "long_text" || Boolean(item.multiline),
    }
  }

  if (kind === "boolean") {
    return {
      kind: "boolean",
      id,
      label,
      required,
      default: typeof item.default === "boolean" ? item.default : item.default === "true",
    }
  }

  if (kind === "aspect_ratio") {
    const defaultVal = typeof item.default === "string" ? item.default : "9:16"
    return {
      kind: "aspect_ratio",
      id,
      label,
      required,
      default: isAspectPreset(defaultVal) ? defaultVal : "9:16",
    }
  }

  if (kind === "toggle" || kind === "select") {
    const options = Array.isArray(item.options) ? item.options : []
    const values = options.map((o) =>
      typeof o === "string" ? o : typeof o === "object" && o && "value" in o ? String((o as { value: string }).value) : "",
    )
    const isRatio =
      values.length > 0 &&
      values.every((v) => ["auto", "9:16", "1:1", "16:9", "4:5", "3:4"].includes(v))

    if (isRatio) {
      const def = typeof item.default === "string" ? item.default : values[0]
      return {
        kind: "aspect_ratio",
        id,
        label,
        required,
        default: isAspectPreset(def) ? def : "9:16",
      }
    }

    if (values.length === 2 && values.every((v) => v === "true" || v === "false" || v === "yes" || v === "no")) {
      return { kind: "boolean", id, label, required, default: false }
    }

    return {
      kind: "aspect_ratio",
      id,
      label,
      required,
      default: "9:16",
    }
  }

  return null
}

export function normalizeTemplateInputs(raw: unknown): TemplateInput[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeTemplateInput).filter((i): i is TemplateInput => i !== null)
}

function isAspectPreset(value: string): value is AspectRatioPreset {
  return value === "auto" || value === "9:16" || value === "1:1" || value === "16:9"
}

export function placeholderToken(input: TemplateInput): string {
  return `{{${input.id}}}`
}

export function buildPlaceholderHint(inputs: TemplateInput[]): string {
  if (inputs.length === 0) return ""
  const tokens = inputs
    .filter((i) => i.kind !== "image" && i.kind !== "video" && i.kind !== "audio")
    .map((i) => placeholderToken(i))
  if (tokens.length === 0) {
    return "Uploaded photos and videos are sent to the AI automatically."
  }
  return `You can reference choices in your instructions: ${tokens.join(", ")}. Photos and videos are attached automatically.`
}
