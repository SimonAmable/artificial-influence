import type {
  ManageAutomationToolInput,
  ManageTemplateToolInput,
} from "@/lib/chat/agent-tool-part-types"

export function formatAutomationActionLabel(action?: ManageAutomationToolInput["action"]) {
  switch (action) {
    case "create":
      return "Create"
    case "update":
      return "Update"
    case "pause":
      return "Pause"
    case "resume":
      return "Resume"
    case "run_now":
      return "Run Now"
    case "delete":
      return "Delete"
    default:
      return "Automation"
  }
}

export function formatAutomationDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString()
}

export function getAutomationPromptPreview(text?: string | null, maxLength = 220) {
  const trimmed = text?.trim()
  if (!trimmed) return null
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength).trimEnd()}...` : trimmed
}

export function formatTemplateActionLabel(action?: ManageTemplateToolInput["action"]) {
  switch (action) {
    case "search":
      return "Search"
    case "get":
      return "Inspect"
    case "create":
      return "Create"
    case "update":
      return "Update"
    default:
      return "Template"
  }
}

export function getTemplatePromptPreview(text?: string | null, maxLength = 220) {
  const trimmed = text?.trim()
  if (!trimmed) return null
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength).trimEnd()}...` : trimmed
}
