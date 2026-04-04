import type {
  CreateMiniAppInput,
  MiniApp,
  UpdateMiniAppInput,
} from "@/lib/mini-apps/types"

export async function fetchMiniAppByWorkflowId(workflowId: string): Promise<MiniApp | null> {
  const response = await fetch(`/api/mini-apps?workflowId=${encodeURIComponent(workflowId)}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error("Failed to fetch mini app")
  return response.json()
}

export async function createMiniAppClient(input: CreateMiniAppInput): Promise<MiniApp> {
  const response = await fetch("/api/mini-apps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(
      typeof errorBody?.error === "string" ? errorBody.error : "Failed to create mini app"
    )
  }

  return response.json()
}

export async function updateMiniAppClient(
  miniAppId: string,
  input: UpdateMiniAppInput
): Promise<MiniApp> {
  const response = await fetch(`/api/mini-apps/${miniAppId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(
      typeof errorBody?.error === "string" ? errorBody.error : "Failed to update mini app"
    )
  }

  return response.json()
}
