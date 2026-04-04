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
      description: "Your inpainted image has been uploaded.",
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
    <main className="h-screen w-full min-w-0 bg-background p-2 sm:p-4 pt-20 overflow-hidden flex flex-col">
      <ImageEditor
        initialImage={initialImage}
        mode="page"
        variant="inpaint"
        onSave={handleSave}
      />
    </main>
  )
}

export default function ImageEditorPage() {
  return (
    <React.Suspense fallback={<main className="h-screen w-full bg-background p-4 pt-20" />}>
      <ImageEditorPageContent />
    </React.Suspense>
  )
}
