"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Copy, Loader2, Plus, Sparkles, Trash2 } from "lucide-react"
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
import { Card, CardContent } from "@/components/ui/card"
import {
  createEditorProjectClient,
  deleteEditorProjectClient,
  duplicateEditorProjectClient,
  fetchEditorProjects,
  updateEditorProjectClient,
} from "@/lib/editor/database"
import type { EditorProjectSummary } from "@/lib/editor/types"
import { formatFramesToDuration } from "@/lib/editor/utils"

export default function EditorProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<EditorProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<EditorProjectSummary | null>(null)

  useEffect(() => {
    void loadProjects()
  }, [])

  async function loadProjects() {
    try {
      setLoading(true)
      const nextProjects = await fetchEditorProjects()
      setProjects(nextProjects)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    const project = await createEditorProjectClient({
      name: "Untitled Project",
    })
    router.push(`/editor/${project.id}`)
  }

  async function handleRename(project: EditorProjectSummary) {
    const nextName = window.prompt("Rename project", project.name)?.trim()
    if (!nextName || nextName === project.name) return
    const updated = await updateEditorProjectClient(project.id, { name: nextName })
    setProjects((current) =>
      current.map((item) => (item.id === updated.id ? { ...item, ...updated, duration_in_frames: updated.composition_settings.durationInFrames } : item)),
    )
  }

  async function handleDuplicate(projectId: string) {
    const duplicate = await duplicateEditorProjectClient(projectId)
    setProjects((current) => [
      {
        ...duplicate,
        duration_in_frames: duplicate.composition_settings.durationInFrames,
      },
      ...current,
    ])
  }

  async function handleConfirmDelete() {
    if (!projectToDelete) return
    try {
      setDeletingId(projectToDelete.id)
      await deleteEditorProjectClient(projectToDelete.id)
      setProjects((current) => current.filter((item) => item.id !== projectToDelete.id))
      setProjectToDelete(null)
    } finally {
      setDeletingId(null)
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
    <div className="min-h-screen bg-background px-4 pb-10 pt-24 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Editor Projects</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Organize your Remotion timelines as reusable projects, then jump into the editor or the agent workspace.
            </p>
          </div>
          <Button onClick={handleCreate} size="lg">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="rounded-full bg-muted p-4">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">No editor projects yet</h2>
                <p className="text-sm text-muted-foreground">
                  Create your first project to start building timelines and controlling them with the agent.
                </p>
              </div>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="overflow-hidden border-border/60">
                <CardContent className="p-0">
                  <div className="relative aspect-video bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
                    {project.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={project.thumbnail_url}
                        alt={project.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-white/60">
                        {project.composition_settings.width}x{project.composition_settings.height}
                      </div>
                    )}
                    <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                      {project.last_render_status}
                    </div>
                  </div>

                  <div className="space-y-4 p-5">
                    <div>
                      <button
                        type="button"
                        onClick={() => handleRename(project)}
                        className="text-left text-lg font-semibold transition-colors hover:text-primary"
                      >
                        {project.name}
                      </button>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {project.composition_settings.width}x{project.composition_settings.height} •{" "}
                        {formatFramesToDuration(
                          project.duration_in_frames,
                          project.composition_settings.fps,
                        )}{" "}
                        • updated {new Date(project.updated_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button asChild>
                        <Link href={`/editor/${project.id}`}>Open Editor</Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href={`/chat?projectId=${project.id}`}>Open Agent</Link>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDuplicate(project.id)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setProjectToDelete(project)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={projectToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setProjectToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete editor project</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete {projectToDelete?.name ?? "this project"} and its saved agent session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
