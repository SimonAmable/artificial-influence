"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { TemplateBuilder } from "@/components/slideshows/template-builder/template-builder"
import type { SlideshowCollection } from "@/lib/slideshow/types"
import type { SlideshowTemplate } from "@/lib/slideshows/types"

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || "Request failed.")
  return body as T
}

export default function EditSlideshowTemplatePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [template, setTemplate] = React.useState<SlideshowTemplate | null>(null)
  const [collections, setCollections] = React.useState<SlideshowCollection[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [templateData, collectionData] = await Promise.all([
          readJson<{ template: SlideshowTemplate }>(
            await fetch(`/api/slideshows/templates/${params.id}`, { cache: "no-store" }),
          ),
          readJson<{ collections: SlideshowCollection[] }>(
            await fetch("/api/slideshows/collections", { cache: "no-store" }),
          ),
        ])
        setTemplate(templateData.template)
        setCollections(collectionData.collections)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load template.")
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [params.id])

  if (loading) {
    return <div className="px-6 py-24 text-sm text-muted-foreground">Loading template...</div>
  }

  if (!template) {
    return <div className="px-6 py-24 text-sm text-muted-foreground">Template not found.</div>
  }

  return (
    <TemplateBuilder
      initialTemplate={template}
      collections={collections}
      onSaved={setTemplate}
      onSaveAndRun={(saved) => {
        router.push(`/slideshows?tab=slideshows&create=1&templateId=${saved.id}`)
      }}
    />
  )
}
