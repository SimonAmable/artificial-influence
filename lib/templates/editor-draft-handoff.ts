import type { TemplateEditorDraft } from "@/lib/templates/editor-draft"

const PENDING_TEMPLATE_EDITOR_DRAFT_KEY = "pendingTemplateEditorDraft"

export function setPendingTemplateEditorDraft(draft: TemplateEditorDraft): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(PENDING_TEMPLATE_EDITOR_DRAFT_KEY, JSON.stringify(draft))
}

export function consumePendingTemplateEditorDraft(): TemplateEditorDraft | null {
  if (typeof window === "undefined") return null

  const raw = sessionStorage.getItem(PENDING_TEMPLATE_EDITOR_DRAFT_KEY)
  if (!raw) return null

  try {
    const draft = JSON.parse(raw) as TemplateEditorDraft
    sessionStorage.removeItem(PENDING_TEMPLATE_EDITOR_DRAFT_KEY)
    return draft
  } catch {
    sessionStorage.removeItem(PENDING_TEMPLATE_EDITOR_DRAFT_KEY)
    return null
  }
}

export function clearPendingTemplateEditorDraft(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(PENDING_TEMPLATE_EDITOR_DRAFT_KEY)
}
