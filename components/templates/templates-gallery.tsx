"use client"

import * as React from "react"
import Link from "next/link"
import type { Template, TemplateCategory } from "@/lib/templates/types"
import { TEMPLATE_CATEGORIES } from "@/lib/templates/types"
import { TemplateCard } from "@/components/templates/template-card"
import { TemplateCreateDialog } from "@/components/templates/template-create-dialog"
import { Button } from "@/components/ui/button"
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
  const rest = publicTemplates.slice(8)
  const [recentThreshold] = React.useState(
    () => Date.now() - 7 * 24 * 60 * 60 * 1000,
  )

  const isRecent = (createdAt: string) => {
    const created = new Date(createdAt).getTime()
    return created >= recentThreshold
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-[60px] sm:px-6 lg:px-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Templates</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Create Viral Content Instantly.
        </p>
      </div>

      <div className="mt-8 flex flex-col items-center gap-4">
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md rounded-full border-muted bg-muted/40"
        />

        <div className="flex flex-wrap justify-center gap-2">
          {(["all", ...TEMPLATE_CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm transition-colors",
                category === cat
                  ? "bg-foreground font-medium text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {currentUserId ? (
          <TemplateCreateDialog />
        ) : (
          <Button asChild className="rounded-full px-5">
            <Link href="/login?next=/templates/new">Create template</Link>
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-16 text-center text-muted-foreground">
          No templates match your search.
        </p>
      ) : (
        <>
          {ownedTemplates.length > 0 ? (
            <section className="mt-12">
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
                  />
                ))}
              </div>
            </section>
          ) : null}

          {popular.length > 0 ? (
            <section className="mt-12">
              <h2 className="mb-4 text-lg font-bold">Popular right now</h2>
              <div className="flex gap-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {popular.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isNew={isRecent(template.created_at)}
                    isOwner={template.creator_id === currentUserId}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {rest.length > 0 ? (
            <section className="mt-12">
              <h2 className="mb-4 text-lg font-bold">
                {ownedTemplates.length > 0 ? "More templates" : "All templates"}
              </h2>
              <div className="flex flex-wrap gap-4">
                {rest.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isNew={isRecent(template.created_at)}
                    isOwner={template.creator_id === currentUserId}
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
