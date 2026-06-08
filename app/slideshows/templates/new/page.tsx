"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { TemplateBuilder } from "@/components/slideshows/template-builder/template-builder"
import type { SlideshowCollection } from "@/lib/slideshow/types"
import type { SlideshowTemplate } from "@/lib/slideshows/types"

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || "Request failed.")
  return body as T
}

export default function NewSlideshowTemplatePage() {
  const router = useRouter()
  const [collections, setCollections] = React.useState<SlideshowCollection[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      try {
        const data = await readJson<{ collections: SlideshowCollection[] }>(
          await fetch("/api/slideshows/collections", { cache: "no-store" }),
        )
        setCollections(data.collections)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load collections.")
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  if (loading) {
    return <div className="px-6 py-24 text-sm text-muted-foreground">Loading template builder...</div>
  }

  return (
    <TemplateBuilder
      collections={collections}
      onSaved={(template) => router.push(`/slideshows/templates/${template.id}/edit`)}
      onSaveAndRun={(template) => {
        router.push(`/slideshows?tab=slideshows&create=1&templateId=${template.id}`)
      }}
    />
  )
}
