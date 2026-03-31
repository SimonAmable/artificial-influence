import type { EditorRuntimeContext } from "@/lib/editor/types"

export const EDITOR_RUNTIME_EVENT = "editor-runtime-context"
export const EDITOR_PROJECT_SYNC_EVENT = "editor-project-sync"

export function dispatchEditorRuntimeContext(context: EditorRuntimeContext) {
  if (typeof window === "undefined") return

  window.dispatchEvent(
    new CustomEvent<EditorRuntimeContext>(EDITOR_RUNTIME_EVENT, {
      detail: context,
    }),
  )
}

export function dispatchEditorProjectSync(projectId: string) {
  if (typeof window === "undefined") return

  window.dispatchEvent(
    new CustomEvent<string>(EDITOR_PROJECT_SYNC_EVENT, {
      detail: projectId,
    }),
  )
}
