"use client"

import * as React from "react"
import type { Template, TemplateCategory } from "@/lib/templates/types"
import { TEMPLATE_CATEGORIES } from "@/lib/templates/types"
import { TemplateCard } from "@/components/templates/template-card"
import { TemplateCreateDialog } from "@/components/templates/template-create-dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const CATEGORY_LABELS: Record<TemplateCategory | "all", string> = {
  all: "All",
  photo: "Photo",
  video: "Video",
  slideshow: "Slideshows",
}

interface TemplatesGalleryProps {
  templates: Template[]
  currentUserId?: string | null
}

export function TemplatesGallery({ templates, currentUserId }: TemplatesGalleryProps) {
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [category, setCategory] = React.useState<TemplateCategory | "all">("all")
  const [galleryTemplates, setGalleryTemplates] = React.useState<Template[]>(templates)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    setGalleryTemplates(templates)
  }, [templates])

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 200)
    return () => window.clearTimeout(timer)
  }, [search])

  React.useEffect(() => {
    const controller = new AbortController()

    async function loadTemplates() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (category !== "all") params.set("category", category)
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim())

        const response = await fetch(`/api/templates?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error("Failed to search templates")

        const payload = (await response.json()) as { templates?: Template[] }
        setGalleryTemplates(payload.templates ?? [])
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[templates-gallery] search failed:", error)
          setGalleryTemplates([])
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadTemplates()

    return () => controller.abort()
  }, [category, debouncedSearch])

  const ownedTemplates = React.useMemo(
    () =>
      currentUserId
        ? galleryTemplates.filter((template) => template.creator_id === currentUserId)
        : [],
    [currentUserId, galleryTemplates],
  )
  const popular = galleryTemplates.slice(0, 8)
  const [recentThreshold] = React.useState(
    () => Date.now() - 7 * 24 * 60 * 60 * 1000,
  )

  const isRecent = (createdAt: string) => {
    const created = new Date(createdAt).getTime()
    return created >= recentThreshold
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-[60px] sm:px-6 lg:px-8">
      <section className="space-y-5">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Templates
            </h1>

            <div className="shrink-0">
              <TemplateCreateDialog currentUserId={currentUserId} />
            </div>
          </div>

          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Create viral content instantly with ready-to-run photo, video, and slideshow
            workflows.
          </p>
        </div>

        <div>
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 max-w-xl rounded-full border-muted bg-muted/40"
          />
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["all", ...TEMPLATE_CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm transition-colors",
                  category === cat
                    ? "border-foreground bg-foreground font-medium text-background"
                    : "border-border/60 bg-muted/20 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            {loading ? "Searching..." : `${galleryTemplates.length} template${galleryTemplates.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </section>

      {galleryTemplates.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">
          {loading ? "Loading templates..." : "No templates match your search."}
        </p>
      ) : (
        <>
          {ownedTemplates.length > 0 ? (
            <section className="mt-10">
              <div className="mb-4 space-y-1">
                <h2 className="text-lg font-bold">Your templates</h2>
                <p className="text-sm text-muted-foreground">
                  Private drafts and published templates you can edit.
                </p>
              </div>
               <div className="flex gap-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                 {ownedTemplates.map((template) => (
                   <TemplateCard
                     key={template.id}
                     template={template}
                     isNew={isRecent(template.created_at)}
                     isOwner
                     layout="scroll"
                   />
                 ))}
               </div>
             </section>
           ) : null}

          {popular.length > 0 ? (
            <section className="mt-10">
              <h2 className="mb-4 text-lg font-bold">Popular right now</h2>
              <div className="flex gap-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {popular.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isNew={isRecent(template.created_at)}
                    isOwner={template.creator_id === currentUserId}
                    layout="scroll"
                  />
                ))}
              </div>
            </section>
          ) : null}

          {galleryTemplates.length > 0 ? (
            <section className="mt-10">
              <h2 className="mb-4 text-lg font-bold">All templates</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-5">
                {galleryTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isNew={isRecent(template.created_at)}
                    isOwner={template.creator_id === currentUserId}
                    layout="grid"
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
