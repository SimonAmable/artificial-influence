"use client"

import { useEffect, useState, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Trash2 } from "lucide-react"
import {
  createStudioProjectClient,
  deleteStudioProjectClient,
  fetchStudioProjects,
} from "@/lib/studio/database"
import type { StudioProject } from "@/lib/studio/types"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function StudioProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<StudioProject[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<StudioProject | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadProjects = async () => {
    try {
      setLoading(true)
      const data = await fetchStudioProjects()
      setProjects(data)
    } catch (error) {
      console.error("Error loading studio projects:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProjects()
  }, [])

  async function handleCreateNew() {
    try {
      setCreating(true)
      const project = await createStudioProjectClient({ name: "Untitled Studio" })
      router.push(`/studio/${project.id}`)
    } catch (error) {
      console.error("Error creating studio project:", error)
      setCreating(false)
    }
  }

  function handleDeleteClick(project: StudioProject, e: MouseEvent) {
    e.stopPropagation()
    setProjectToDelete(project)
    setDeleteDialogOpen(true)
  }

  async function handleConfirmDelete() {
    if (!projectToDelete) return
    try {
      setDeleting(true)
      await deleteStudioProjectClient(projectToDelete.id)
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id))
      setDeleteDialogOpen(false)
      setProjectToDelete(null)
    } catch (error) {
      console.error("Error deleting studio project:", error)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 pb-8 pt-20">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Project-based image generation on an infinite canvas.
          </p>
        </div>
        <Button onClick={() => void handleCreateNew()} size="lg" disabled={creating}>
          {creating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          New project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">No studio projects yet</h2>
          <p className="mb-6 max-w-md text-muted-foreground">
            Create a project to generate images on a freeform board. Select any image to use it as
            a reference.
          </p>
          <Button onClick={() => void handleCreateNew()} disabled={creating}>
            <Plus className="mr-2 h-4 w-4" />
            Create project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className="group relative overflow-hidden rounded-xl border border-border/70 bg-card text-left transition hover:border-border"
              onClick={() => router.push(`/studio/${project.id}`)}
            >
              <div className="relative aspect-[4/3] w-full bg-muted">
                {project.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={project.thumbnail_url}
                    alt={project.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                    Empty board
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{project.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(project.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 opacity-70 hover:opacity-100"
                  onClick={(event) => handleDeleteClick(project, event)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </button>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete studio project?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the project board. Generations stay in your library but lose their studio
              placement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmDelete()} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
