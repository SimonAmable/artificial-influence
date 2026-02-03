import type { SavedWorkflow } from "./types"

const STORAGE_KEY = "canvas-workflows"

function getAll(): SavedWorkflow[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setAll(workflows: SavedWorkflow[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows))
}

export function saveWorkflow(workflow: SavedWorkflow): void {
  const all = getAll()
  const index = all.findIndex((w) => w.id === workflow.id)
  if (index >= 0) {
    all[index] = workflow
  } else {
    all.push(workflow)
  }
  setAll(all)
}

export function loadWorkflow(id: string): SavedWorkflow | null {
  return getAll().find((w) => w.id === id) ?? null
}

export function listWorkflows(): SavedWorkflow[] {
  return getAll().sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  )
}

export function deleteWorkflow(id: string): void {
  setAll(getAll().filter((w) => w.id !== id))
}
