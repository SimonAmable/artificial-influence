import type {
  CreateEditorProjectInput,
  EditorAgentSession,
  EditorProject,
  EditorProjectSummary,
  EditorRenderJob,
  UpdateEditorProjectInput,
} from "@/lib/editor/types"

export async function fetchEditorProjects(): Promise<EditorProjectSummary[]> {
  const response = await fetch("/api/editor-projects")
  if (!response.ok) {
    throw new Error("Failed to fetch editor projects")
  }
  return response.json()
}

export async function createEditorProjectClient(
  input: CreateEditorProjectInput,
): Promise<EditorProject> {
  const response = await fetch("/api/editor-projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error("Failed to create editor project")
  }
  return response.json()
}

export async function fetchEditorProject(
  projectId: string,
): Promise<EditorProject> {
  const response = await fetch(`/api/editor-projects/${projectId}`)
  if (!response.ok) {
    throw new Error("Failed to fetch editor project")
  }
  return response.json()
}

export async function updateEditorProjectClient(
  projectId: string,
  updates: UpdateEditorProjectInput,
): Promise<EditorProject> {
  const response = await fetch(`/api/editor-projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  })
  if (!response.ok) {
    throw new Error("Failed to update editor project")
  }
  return response.json()
}

export async function deleteEditorProjectClient(projectId: string): Promise<void> {
  const response = await fetch(`/api/editor-projects/${projectId}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    throw new Error("Failed to delete editor project")
  }
}

export async function duplicateEditorProjectClient(
  projectId: string,
): Promise<EditorProject> {
  const response = await fetch(`/api/editor-projects/${projectId}/duplicate`, {
    method: "POST",
  })
  if (!response.ok) {
    throw new Error("Failed to duplicate editor project")
  }
  return response.json()
}

export async function fetchEditorAgentSession(
  projectId: string,
): Promise<EditorAgentSession> {
  const response = await fetch(`/api/editor-agent-sessions?projectId=${encodeURIComponent(projectId)}`)
  if (!response.ok) {
    throw new Error("Failed to fetch editor agent session")
  }
  return response.json()
}

export async function saveEditorAgentSessionClient(
  projectId: string,
  updates: Partial<Pick<EditorAgentSession, "messages" | "pending_action" | "command_history">>,
): Promise<EditorAgentSession> {
  const response = await fetch("/api/editor-agent-sessions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, ...updates }),
  })
  if (!response.ok) {
    throw new Error("Failed to save editor agent session")
  }
  return response.json()
}

export async function createEditorRenderJobClient(
  projectId: string,
): Promise<EditorRenderJob> {
  const response = await fetch(`/api/editor-projects/${projectId}/render`, {
    method: "POST",
  })
  if (!response.ok) {
    throw new Error("Failed to create render job")
  }
  return response.json()
}

export async function fetchEditorRenderJob(
  renderId: string,
): Promise<EditorRenderJob> {
  const response = await fetch(`/api/editor-renders/${renderId}`)
  if (!response.ok) {
    throw new Error("Failed to fetch render job")
  }
  return response.json()
}
