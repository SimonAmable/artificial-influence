"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { ImageEditor } from "@/components/image-editor"
import { toast } from "sonner"

function ImageEditorPageContent() {
  const searchParams = useSearchParams()
  const initialImage = searchParams.get("image") || undefined

  const handleSave = async (imageUrl: string) => {
    // In standalone mode, show success toast with download option
    toast.success("Image saved!", {
      description: "Your edited image has been uploaded.",
      action: {
        label: "Download",
        onClick: () => {
          // Download the image
          const link = document.createElement("a")
          link.href = imageUrl
          link.download = `edited-image-${Date.now()}.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        },
      },
    })
  }

  return (
    <main className="h-screen bg-zinc-950 p-4 pt-20">
      <ImageEditor
        initialImage={initialImage}
        mode="page"
        onSave={handleSave}
      />
    </main>
  )
}

export default function ImageEditorPage() {
  return (
    <React.Suspense fallback={<main className="h-screen bg-zinc-950 p-4 pt-20" />}>
      <ImageEditorPageContent />
    </React.Suspense>
  )
}
