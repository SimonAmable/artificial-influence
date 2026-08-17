import type {
  CreateStudioProjectInput,
  StudioProject,
  UpdateStudioProjectInput,
} from "@/lib/studio/types"

export async function fetchStudioProjects(): Promise<StudioProject[]> {
  const response = await fetch("/api/studio/projects")
  if (!response.ok) {
    throw new Error("Failed to fetch studio projects")
  }
  return response.json()
}

export async function fetchStudioProject(projectId: string): Promise<StudioProject> {
  const response = await fetch(`/api/studio/projects/${projectId}`)
  if (!response.ok) {
    throw new Error("Failed to fetch studio project")
  }
  return response.json()
}

export async function createStudioProjectClient(
  input: CreateStudioProjectInput = {},
): Promise<StudioProject> {
  const response = await fetch("/api/studio/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error("Failed to create studio project")
  }
  return response.json()
}

export async function updateStudioProjectClient(
  projectId: string,
  input: UpdateStudioProjectInput,
): Promise<StudioProject> {
  const response = await fetch(`/api/studio/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error("Failed to update studio project")
  }
  return response.json()
}

export async function deleteStudioProjectClient(projectId: string): Promise<void> {
  const response = await fetch(`/api/studio/projects/${projectId}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    throw new Error("Failed to delete studio project")
  }
}

export async function updateGenerationStudioLayout(options: {
  generationId: string
  x: number
  y: number
  width?: number
  height?: number
  projectId?: string
}): Promise<void> {
  const response = await fetch(`/api/generations/${options.generationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studio_x: options.x,
      studio_y: options.y,
      ...(typeof options.width === "number" ? { studio_width: options.width } : {}),
      ...(typeof options.height === "number" ? { studio_height: options.height } : {}),
      ...(options.projectId ? { studio_project_id: options.projectId } : {}),
    }),
  })
  if (!response.ok) {
    throw new Error("Failed to update generation layout")
  }
}
