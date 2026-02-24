"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { fetchUserCanvases, deleteCanvasClient, type Canvas } from "@/lib/canvas/database"
import { Loader2, Plus, Trash2 } from "lucide-react"
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

export function CanvasesSection() {
  const router = useRouter()
  const [canvases, setCanvases] = React.useState<Canvas[]>([])
  const [loading, setLoading] = React.useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [canvasToDelete, setCanvasToDelete] = React.useState<Canvas | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        const data = await fetchUserCanvases()
        if (isMounted) setCanvases(data)
      } catch (error) {
        console.error("Error loading canvases:", error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  function handleOpenCanvas(canvasId: string) {
    router.push(`/canvas/${canvasId}`)
  }

  function handleDeleteClick(canvas: Canvas, e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    setCanvasToDelete(canvas)
    setDeleteDialogOpen(true)
  }

  async function handleConfirmDelete() {
    if (!canvasToDelete) return

    try {
      setDeleting(true)
      await deleteCanvasClient(canvasToDelete.id)
      setCanvases((prev) => prev.filter((c) => c.id !== canvasToDelete.id))
      setDeleteDialogOpen(false)
      setCanvasToDelete(null)
    } catch (error) {
      console.error("Error deleting canvas:", error)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="mx-auto w-full pb-16 pt-10">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-semibold">Canvases</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/canvases">View all</Link>
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="w-full aspect-[4/3] rounded-t-lg bg-muted/50" />
              <div className="p-2 space-y-2">
                <div className="h-5 w-3/4 rounded bg-muted/60" />
                <div className="h-3 w-1/2 rounded bg-muted/60" />
              </div>
            </div>
          ))}
        </div>
      ) : canvases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
            <Plus className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No canvases yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first canvas to start building workflows
          </p>
          <Button asChild>
            <Link href="/canvases">
              <Plus className="w-4 h-4 mr-2" />
              Create Canvas
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {canvases.map((canvas) => (
            <div
              key={canvas.id}
              className="group cursor-pointer transition-opacity relative"
              onClick={() => handleOpenCanvas(canvas.id)}
            >
              <div className="p-0">
                <div className="relative w-full aspect-[4/3] rounded-t-lg overflow-hidden">
                  {canvas.thumbnail_url ? (
                    <Image
                      src={canvas.thumbnail_url}
                      alt={canvas.name}
                      fill
                      className="object-cover rounded-[24px]"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50 rounded-[24px]">
                      <svg
                        className="w-12 h-12 text-muted-foreground/30"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z"
                        />
                      </svg>
                    </div>
                  )}

                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDeleteClick(canvas, e)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="p-2">
                  <h3 className="font-semibold text-lg truncate">{canvas.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(canvas.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Canvas</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{canvasToDelete?.name}&quot;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
