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
  const [category, setCategory] = React.useState<TemplateCategory | "all">("all")

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return templates.filter((template) => {
      if (category !== "all" && template.category !== category) return false
      if (!q) return true
      return (
        template.title.toLowerCase().includes(q) ||
        template.description.toLowerCase().includes(q) ||
        template.slug.toLowerCase().includes(q)
      )
    })
  }, [templates, search, category])

  const ownedTemplates = React.useMemo(
    () =>
      currentUserId
        ? filtered.filter((template) => template.creator_id === currentUserId)
        : [],
    [currentUserId, filtered],
  )
  const publicTemplates = React.useMemo(
    () => filtered.filter((template) => template.creator_id !== currentUserId),
    [currentUserId, filtered],
  )
  const popular = publicTemplates.slice(0, 8)
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
            {filtered.length} template{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
      </section>

      {filtered.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">
          No templates match your search.
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
              <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-5">
                {popular.map((template) => (
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

          {publicTemplates.length > 0 ? (
            <section className="mt-10">
              <h2 className="mb-4 text-lg font-bold">All templates</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-5">
                {publicTemplates.map((template) => (
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
