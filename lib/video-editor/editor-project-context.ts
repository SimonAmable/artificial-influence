const EDITOR_PROJECT_SESSION_KEY = "unican-editor-project-id"

export function readStoredEditorProjectId(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  if (!window.location.pathname.startsWith("/editor")) {
    return null
  }

  try {
    const value = window.sessionStorage.getItem(EDITOR_PROJECT_SESSION_KEY)
    return typeof value === "string" && value.length > 0 ? value : null
  } catch {
    return null
  }
}

export function writeStoredEditorProjectId(projectId: string | null | undefined) {
  if (typeof window === "undefined") {
    return
  }

  try {
    if (typeof projectId === "string" && projectId.length > 0) {
      window.sessionStorage.setItem(EDITOR_PROJECT_SESSION_KEY, projectId)
    } else {
      window.sessionStorage.removeItem(EDITOR_PROJECT_SESSION_KEY)
    }
  } catch {
    /* ignore session storage failures */
  }
}
