"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createCanvasClient } from "@/lib/canvas/database"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

/**
 * Base canvas route - Creates a new canvas and redirects to /canvas/[id]
 */
export default function CanvasPage() {
  const router = useRouter()

  React.useEffect(() => {
    async function createNewCanvas() {
      try {
        const canvas = await createCanvasClient({
          name: "Canvas",
          nodes: [],
          edges: [],
        })
        
        // Redirect to the new canvas
        router.replace(`/canvas/${canvas.id}`)
      } catch (error) {
        console.error("Error creating canvas:", error)
        toast.error("Failed to create canvas")
        router.push("/canvases")
      }
    }

    createNewCanvas()
  }, [router])

  return (
    <div className="flex items-center justify-center w-full h-screen">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Creating new canvas...</p>
      </div>
    </div>
  )
}
