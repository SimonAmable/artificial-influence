import type { Template, TemplateInput } from "@/lib/templates/types"
import type { TemplateInputValues } from "@/lib/templates/prompt-filler"
import { getDefaultInputValue, isMediaInputKind } from "@/lib/templates/validation"

function isRequiredInput(input: TemplateInput): boolean {
  return Boolean(input.required)
}

export function validateRunInputValues(
  template: Template,
  values: TemplateInputValues,
): { ok: true; values: TemplateInputValues } | { ok: false; error: string } {
  const normalized: TemplateInputValues = { ...values }

  for (const input of template.inputs) {
    const raw = values[input.id]

    if (isMediaInputKind(input.kind)) {
      if (typeof raw !== "string" || raw.trim().length === 0) {
        if (isRequiredInput(input)) {
          return { ok: false, error: `${input.label} is required` }
        }
        continue
      }
      if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
        return { ok: false, error: `${input.label} must be a valid uploaded file` }
      }
      normalized[input.id] = raw.trim()
      continue
    }

    if (input.kind === "boolean") {
      if (typeof raw === "boolean") {
        normalized[input.id] = raw
        continue
      }
      if (raw === "true" || raw === "yes" || raw === "1") {
        normalized[input.id] = true
        continue
      }
      if (raw === "false" || raw === "no" || raw === "0" || raw === "" || raw === undefined) {
        if (isRequiredInput(input) && raw === undefined) {
          return { ok: false, error: `${input.label} is required` }
        }
        normalized[input.id] = false
        continue
      }
      normalized[input.id] = Boolean(raw)
      continue
    }

    if (input.kind === "aspect_ratio") {
      const str = typeof raw === "string" ? raw.trim() : ""
      const allowed = ["auto", "9:16", "1:1", "16:9"]
      if (!str) {
        if (isRequiredInput(input)) {
          return { ok: false, error: `${input.label} is required` }
        }
        normalized[input.id] = getDefaultInputValue(input)
        continue
      }
      if (!allowed.includes(str)) {
        return { ok: false, error: `${input.label} has an invalid value` }
      }
      normalized[input.id] = str
      continue
    }

    const str = typeof raw === "string" ? raw.trim() : raw !== undefined && raw !== null ? String(raw) : ""
    if (str.length === 0) {
      if (isRequiredInput(input)) {
        return { ok: false, error: `${input.label} is required` }
      }
      normalized[input.id] = String(getDefaultInputValue(input))
      continue
    }

    normalized[input.id] = str
  }

  return { ok: true, values: normalized }
}
