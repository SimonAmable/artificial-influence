import type { MiniApp } from "@/lib/mini-apps/types"

export async function fetchMiniAppById(miniAppId: string): Promise<MiniApp> {
  const response = await fetch(`/api/mini-apps/${miniAppId}`)
  if (!response.ok) {
    throw new Error("Failed to fetch mini app")
  }

  return response.json()
}
