"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { fetchUserCanvases, deleteCanvasClient, type Canvas } from "@/lib/canvas/database"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Loader2 } from "lucide-react"
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
import Image from "next/image"

export function CanvasesPage() {
  const router = useRouter()
  const [canvases, setCanvases] = useState<Canvas[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [canvasToDelete, setCanvasToDelete] = useState<Canvas | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadCanvases = async () => {
    try {
      setLoading(true)
      const data = await fetchUserCanvases()
      setCanvases(data)
    } catch (error) {
      console.error("Error loading canvases:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCanvases()
  }, [])

  function handleCreateNew() {
    router.push("/canvas")
  }

  function handleOpenCanvas(canvasId: string) {
    router.push(`/canvas/${canvasId}`)
  }

  function handleDeleteClick(canvas: Canvas, e: React.MouseEvent) {
    e.stopPropagation()
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto pt-20 px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">My Canvases</h1>
        <Button onClick={handleCreateNew} size="lg">
          <Plus className="w-4 h-4 mr-2" />
          New Canvas
        </Button>
      </div>

      {canvases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
            <Plus className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No canvases yet</h2>
          <p className="text-muted-foreground mb-6">
            Create your first canvas to start building workflows
          </p>
          <Button onClick={handleCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Create Canvas
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
                {/* Thumbnail */}
                <div className="relative w-full aspect-[4/3] rounded-t-lg overflow-hidden">
                  {canvas.thumbnail_url ? (
                    <Image
                      src={canvas.thumbnail_url}
                      alt={canvas.name}
                      fill
                      className="object-cover rounded-[24px]"

                    />
                  ) : (
                    <div
                      className="w-full h-full overflow-hidden rounded-[24px] bg-muted/40 bg-[radial-gradient(circle,color-mix(in_oklch,var(--foreground)_18%,transparent)_1px,transparent_1.5px)] bg-size-[16px_16px] bg-position-center"
                      aria-hidden
                    />
                  )}

                  {/* Delete button (appears on hover) */}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDeleteClick(canvas, e)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Canvas name */}
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

      {/* Delete confirmation dialog */}
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
    </div>
  )
}
