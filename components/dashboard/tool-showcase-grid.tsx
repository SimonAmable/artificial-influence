"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, PencilSimple } from "@phosphor-icons/react"
import { useReducedMotion } from "framer-motion"

import { ToolShowcaseDemo } from "@/components/dashboard/tool-showcase-demo"
import {
  getToolShowcasePreview,
  type ToolShowcaseMedia,
  type ToolShowcasePreview,
} from "@/components/dashboard/tool-showcase-preview-data"
import { AuroraShaderBackground } from "@/components/ui/aurora-shader-background"
import { Button } from "@/components/ui/button"
import {
  getDashboardToolNavItems,
  type DashboardToolNavItem,
} from "@/lib/constants/navigation"
import { getNavIcon } from "@/lib/navigation/nav-icons"
import { cn } from "@/lib/utils"

function PreviewMediaItem({
  media,
  priority,
  className,
}: {
  media: ToolShowcaseMedia
  priority: boolean
  className?: string
}) {
  if (media.type === "video") {
    return (
      <video
        src={media.src}
        poster={media.poster}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className={cn("size-full object-cover", className)}
      />
    )
  }

  return (
    <span className={cn("relative block size-full overflow-hidden", className)}>
      <Image
        src={media.src}
        alt=""
        fill
        priority={priority}
        sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
        className="object-cover"
        style={{ objectPosition: media.position }}
      />
    </span>
  )
}

function PreviewMedia({
  preview,
  priority,
}: {
  preview: ToolShowcasePreview
  priority: boolean
}) {
  const items = preview.media.slice(0, 4)

  if (items.length === 1) {
    return <PreviewMediaItem media={items[0]} priority={priority} />
  }

  if (items.length === 2) {
    return (
      <div className="grid size-full grid-cols-2 gap-1.5 p-1.5">
        {items.map((media) => (
          <PreviewMediaItem
            key={media.src}
            media={media}
            priority={priority}
            className="rounded-xl"
          />
        ))}
      </div>
    )
  }

  if (items.length === 3) {
    return (
      <div className="grid size-full grid-cols-[1.5fr_1fr] gap-1.5 p-1.5">
        <PreviewMediaItem
          media={items[0]}
          priority={priority}
          className="rounded-xl"
        />
        <div className="grid min-h-0 grid-rows-2 gap-1.5">
          {items.slice(1).map((media) => (
            <PreviewMediaItem
              key={media.src}
              media={media}
              priority={priority}
              className="rounded-xl"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="grid size-full grid-cols-2 grid-rows-2 gap-1.5 p-1.5">
      {items.map((media) => (
        <PreviewMediaItem
          key={media.src}
          media={media}
          priority={priority}
          className="rounded-xl"
        />
      ))}
    </div>
  )
}

function ToolShowcaseCard({
  tool,
  preview,
  active,
  priority,
  reducedMotion,
  onActivate,
  onDeactivate,
}: {
  tool: DashboardToolNavItem
  preview: ToolShowcasePreview
  active: boolean
  priority: boolean
  reducedMotion: boolean
  onActivate: () => void
  onDeactivate: () => void
}) {
  const Icon = getNavIcon(tool.icon)

  return (
    <Link
      href={tool.href}
      aria-label={`Open ${tool.label}`}
      onPointerEnter={onActivate}
      onPointerLeave={onDeactivate}
      onFocus={onActivate}
      onBlur={onDeactivate}
      className={cn(
        "group flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-border/70 bg-card p-2 shadow-sm outline-none transition duration-300",
        "hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[18px] border border-border/50 bg-muted/30">
        <div
          className={cn(
            "absolute inset-0 transition duration-300 ease-out",
            active
              ? "scale-[1.035] opacity-0"
              : "scale-100 opacity-100 group-hover:scale-[1.015]",
          )}
        >
          <PreviewMedia preview={preview} priority={priority} />
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-t from-background/35 via-transparent to-transparent"
            aria-hidden
          />
        </div>

        {active ? (
          <div className="absolute inset-0 animate-in fade-in duration-300">
            <AuroraShaderBackground
              key={preview.shader}
              variant={preview.shader}
              animate={!reducedMotion}
              className="rounded-[inherit]"
            />
            <div className="absolute inset-0 bg-background/18" aria-hidden />
            <ToolShowcaseDemo
              tool={tool}
              preview={preview}
              reducedMotion={reducedMotion}
            />
          </div>
        ) : null}

        <span className="pointer-events-none absolute left-3 top-3 flex size-8 items-center justify-center rounded-xl border border-border/70 bg-background/80 text-foreground shadow-sm backdrop-blur-md">
          <Icon className="size-4" weight="regular" />
        </span>
      </div>

      <span className="mt-2 flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-muted/50 text-xs font-semibold text-foreground transition group-hover:border-primary/35 group-hover:bg-primary group-hover:text-primary-foreground">
        Open
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" weight="bold" />
      </span>

      <span className="block px-1 pb-2 pt-3">
        <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
          {tool.label}
        </span>
        <span className="mt-1 block min-h-10 text-xs leading-5 text-muted-foreground line-clamp-2">
          {tool.hint}
        </span>
      </span>
    </Link>
  )
}

export function ToolShowcaseGrid() {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const [activeToolHref, setActiveToolHref] = React.useState<string | null>(null)
  const [isCreatingProject, setIsCreatingProject] = React.useState(false)
  const tools = getDashboardToolNavItems()

  const handleCreateProject = async () => {
    try {
      setIsCreatingProject(true)
      const response = await fetch("/api/canvases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Canvas ${new Date().toLocaleDateString()}`,
          description: "New canvas project",
        }),
      })

      if (!response.ok) throw new Error("Failed to create canvas")

      const canvas = (await response.json()) as { id: string }
      router.push(`/canvas/${canvas.id}`)
    } catch (error) {
      console.error("Error creating canvas:", error)
      window.alert("Failed to create canvas. Please try again.")
    } finally {
      setIsCreatingProject(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Create your way
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">All tools</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            Hover a tool for a quick preview, then open it when inspiration strikes.
          </p>
        </div>

        <Button
          onClick={() => void handleCreateProject()}
          disabled={isCreatingProject}
          size="lg"
          variant="ghost"
          className="self-start shadow-sm transition-shadow hover:shadow-md sm:self-auto"
        >
          <PencilSimple size={18} weight="bold" className="mr-2" />
          {isCreatingProject ? "Creating…" : "Create New Project"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {tools.map((tool, index) => {
          const preview = getToolShowcasePreview(tool)
          return (
            <ToolShowcaseCard
              key={tool.href}
              tool={tool}
              preview={preview}
              active={activeToolHref === tool.href}
              priority={index < 4}
              reducedMotion={Boolean(prefersReducedMotion)}
              onActivate={() => setActiveToolHref(tool.href)}
              onDeactivate={() =>
                setActiveToolHref((current) => (current === tool.href ? null : current))
              }
            />
          )
        })}
      </div>
    </div>
  )
}
