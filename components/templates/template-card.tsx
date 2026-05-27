import Link from "next/link"
import {
  GlobeHemisphereWest,
  Image as ImageIcon,
  Images,
  LockSimple,
  MusicNote,
  Sparkle,
  Video,
} from "@phosphor-icons/react"
import type { Template } from "@/lib/templates/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TemplateCardProps {
  template: Template
  className?: string
  isNew?: boolean
  isOwner?: boolean
}

export function TemplateCard({
  template,
  className,
  isNew = false,
  isOwner = false,
}: TemplateCardProps) {
  const outputLabel =
    template.output_kind === "video"
      ? "VIDEO"
      : template.output_kind === "image"
        ? "PHOTO"
        : template.output_kind.toUpperCase()
  const OutputIcon =
    template.output_kind === "video"
      ? Video
      : template.output_kind === "image"
        ? ImageIcon
        : template.output_kind === "audio"
          ? MusicNote
          : template.output_kind === "slideshow"
            ? Images
            : Sparkle
  const VisibilityIcon = template.visibility === "public" ? GlobeHemisphereWest : LockSimple
  const editHref = `/templates/edit/${template.id}`

  return (
    <div className={cn("group shrink-0 space-y-2", className)}>
      <div className="relative">
        {isOwner ? (
          <div className="pointer-events-none absolute right-2 top-2 z-20 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
            <Button
              asChild
              size="xs"
              variant="secondary"
              className="pointer-events-auto border border-border/60 bg-background/85 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
            >
              <Link href={editHref}>Edit</Link>
            </Button>
          </div>
        ) : null}

        <Link href={`/templates/${template.slug}`} className="block">
          <div className="relative aspect-[3/4] w-[140px] overflow-hidden rounded-2xl bg-zinc-900 sm:w-[160px]">
            {template.thumbnail_url ? (
              template.thumbnail_kind === "video" ? (
                <video
                  src={template.thumbnail_url}
                  className="h-full w-full object-cover opacity-90 transition group-hover:scale-[1.02]"
                  muted
                  playsInline
                  loop
                  autoPlay
                />
              ) : (
                <img
                  src={template.thumbnail_url}
                  alt={template.title}
                  className="h-full w-full object-cover opacity-90 transition group-hover:scale-[1.02]"
                />
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-xs text-zinc-500">
                No preview
              </div>
            )}

            <div className="absolute left-2 top-2 flex flex-col gap-1">
              {isNew ? (
                <Badge
                  variant="secondary"
                  className="bg-secondary/90 text-[10px] uppercase tracking-wide text-secondary-foreground backdrop-blur-sm"
                >
                  NEW
                </Badge>
              ) : null}
              {isOwner ? (
                <Badge
                  variant="outline"
                  className="border-border/60 bg-background/85 text-[10px] uppercase tracking-wide text-foreground backdrop-blur-sm"
                >
                  <VisibilityIcon className="h-3 w-3" />
                  {template.visibility}
                </Badge>
              ) : null}
              <Badge
                variant="outline"
                className="border-border/60 bg-background/85 text-[10px] uppercase tracking-wide text-foreground backdrop-blur-sm"
              >
                <OutputIcon className="h-3 w-3" />
                {outputLabel}
              </Badge>
            </div>

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-10">
              <p className="truncate text-sm font-semibold uppercase leading-tight text-white">
                {template.title}
              </p>
              <p className="mt-1 text-xs text-white/70">{template.credits_cost} credits</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
