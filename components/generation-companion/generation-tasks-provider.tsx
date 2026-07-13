"use client"

import * as React from "react"

export type GenerationTask = {
  id: string
  type: "image" | "video" | "audio" | string
  status: "pending" | "completed" | "failed" | string
  model: string | null
  prompt: string | null
  tool: string | null
  createdAt: string | null
  errorMessage: string | null
  url: string | null
  referenceImageUrls: string[]
  isRecentCompletion: boolean
}

type GenerationTasksContextValue = {
  tasks: GenerationTask[]
  refresh: () => Promise<void>
}

const GenerationTasksContext = React.createContext<GenerationTasksContextValue | null>(null)

function normalizeTask(row: Record<string, unknown>): GenerationTask | null {
  if (typeof row.id !== "string") return null
  return {
    id: row.id,
    type: typeof row.type === "string" ? row.type : "image",
    status: typeof row.status === "string" ? row.status : "pending",
    model: typeof row.model === "string" ? row.model : null,
    prompt: typeof row.prompt === "string" ? row.prompt : null,
    tool: typeof row.tool === "string" ? row.tool : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    errorMessage: typeof row.error_message === "string" ? row.error_message : null,
    url: typeof row.url === "string" ? row.url : null,
    referenceImageUrls: Array.isArray(row.reference_image_urls)
      ? row.reference_image_urls.filter((value): value is string => typeof value === "string")
      : [],
    isRecentCompletion:
      row.status === "completed" &&
      typeof row.created_at === "string" &&
      Date.now() - Date.parse(row.created_at) < 2 * 60_000,
  }
}

export function GenerationTasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = React.useState<GenerationTask[]>([])

  const refresh = React.useCallback(async () => {
    try {
      const response = await fetch("/api/generations?limit=30&includePending=true&excludeFailed=false", {
        cache: "no-store",
      })
      if (!response.ok) return
      const payload = await response.json() as { generations?: Record<string, unknown>[] }
      setTasks((payload.generations ?? []).map(normalizeTask).filter((task): task is GenerationTask => Boolean(task)))
    } catch {
      // The companion is supplementary UI; individual generator pages retain their own error handling.
    }
  }, [])

  React.useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 10_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  return <GenerationTasksContext.Provider value={{ tasks, refresh }}>{children}</GenerationTasksContext.Provider>
}

export function useGenerationTasks() {
  const context = React.useContext(GenerationTasksContext)
  if (!context) throw new Error("useGenerationTasks must be used inside GenerationTasksProvider")
  return context
}
