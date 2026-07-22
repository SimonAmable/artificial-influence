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
import { ReportContentButton } from "@/components/app/report-content-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TemplateCardProps {
  template: Template
  className?: string
  isNew?: boolean
  isOwner?: boolean
  layout?: "scroll" | "grid"
}

export function TemplateCard({
  template,
  className,
  isNew = false,
  isOwner = false,
  layout = "scroll",
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
  const isGrid = layout === "grid"
  const cardWidthClass = isGrid ? "w-full min-w-0" : "w-[210px] shrink-0 sm:w-[240px]"

  return (
    <div
      className={cn(
        "group space-y-3",
        cardWidthClass,
        className,
      )}
    >
      <Link href={`/templates/${template.slug}`} className="block">
        <div
          className={cn(
            "relative aspect-[3/4] overflow-hidden rounded-2xl bg-zinc-900",
            "w-full",
          )}
        >
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

          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10" />

          <div className="absolute left-2 top-2 flex max-w-[calc(100%-1rem)] flex-row flex-wrap gap-1">
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
          {template.visibility === "public" && !isOwner ? (
            <div className="absolute right-2 top-2">
              <ReportContentButton
                contentType="template"
                contentId={template.id}
                contentSlug={template.slug}
                contentUrl={`/templates/${template.slug}`}
                className="bg-background/85 text-foreground backdrop-blur-sm hover:bg-background"
              />
            </div>
          ) : null}
        </div>
      </Link>

      <div className="min-w-0 space-y-2 px-1">
        <Link
          href={`/templates/${template.slug}`}
          className="block min-w-0 text-sm font-semibold uppercase leading-tight text-foreground transition-colors hover:text-foreground/80"
        >
          <p className="truncate">{template.title}</p>
        </Link>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{template.credits_cost} credits</p>
          {isOwner ? (
            <Button
              asChild
              size="xs"
              variant="secondary"
              className="border border-border/60 bg-background/85 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
            >
              <Link href={editHref}>Edit</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
