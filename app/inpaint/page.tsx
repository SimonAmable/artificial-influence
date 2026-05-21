"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { ImageEditor } from "@/components/image-editor"
import { toast } from "sonner"

function InpaintPageContent() {
  const searchParams = useSearchParams()
  const initialImage = searchParams.get("image") || undefined

  const handleSave = () => {
    toast.success("Image downloaded", {
      description: "Your edited image has been saved to your device.",
    })
  }

  return (
    <main className="flex h-screen min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background px-2 pb-2 pt-[52px] sm:px-4 sm:pb-4">
      <ImageEditor
        initialImage={initialImage}
        mode="page"
        variant="inpaint"
        onSave={handleSave}
      />
    </main>
  )
}

export default function InpaintPage() {
  return (
    <React.Suspense
      fallback={<main className="flex h-screen min-h-0 w-full flex-col bg-background px-4 pb-4 pt-[52px]" />}
    >
      <InpaintPageContent />
    </React.Suspense>
  )
}
