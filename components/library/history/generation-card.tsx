"use client"

import {
  DownloadSimple,
  Heart,
  PaperPlaneTilt,
  Vault,
} from "@phosphor-icons/react"

import { CardDropdownActions } from "@/components/library/history/card-dropdown-actions"
import { MediaPreview, MediaTypeIcon } from "@/components/library/history/media-preview"
import type {
  FanvueGenerationActions,
  Generation,
  GenerationCardActionVariant,
  SaveAssetDraft,
} from "@/components/library/history/types"
import { formatRelativeDate } from "@/components/library/history/utils"
import type { AssetType } from "@/lib/assets/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type GenerationCardProps = {
  generation: Generation
  actionVariant: GenerationCardActionVariant
  onOpen: (generation: Generation) => void
  onCopy: (url: string, type: AssetType) => void
  onDownload: (url: string, type: AssetType, title?: string) => void
  onDelete: (generation: Generation) => void
  onSave?: (draft: SaveAssetDraft) => void
  onSaveExample?: (generation: Generation) => void
  onAnimate?: (generation: Generation) => void
  onEditImage?: (url: string) => void
  fanvueActions?: FanvueGenerationActions
  getDefaultCategoryByMediaType?: (type: AssetType) => import("@/lib/assets/types").AssetCategory
}

function sourceLabel(source: Generation["source"]) {
  return source === "upload" ? "Upload" : "Generation"
}

export function GenerationCard({
  generation,
  actionVariant,
  onOpen,
  onCopy,
  onDownload,
  onDelete,
  onSave,
  onSaveExample,
  onAnimate,
  onEditImage,
  fanvueActions,
  getDefaultCategoryByMediaType,
}: GenerationCardProps) {
  const supportsFanvue = generation.type === "image" || generation.type === "video"
  const source = generation.source === "upload" ? "upload" : "generation"

  if (actionVariant === "select") {
    return (
      <article className="group relative aspect-square overflow-hidden rounded-2xl border border-border/70 bg-card/45 shadow-sm transition-all hover:border-primary/50 hover:shadow-md">
        <MediaPreview
          type={generation.type}
          url={generation.url}
          alt={generation.prompt || "Generated media"}
          onOpen={generation.type === "audio" ? undefined : () => onOpen(generation)}
        />

        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between bg-black/50 p-3 opacity-0 transition-opacity duration-200 sm:group-hover:opacity-100">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge
              variant="secondary"
              className="gap-1 rounded-full border-none bg-black/60 px-2 py-0.5 text-[10px] capitalize text-white"
            >
              <MediaTypeIcon type={generation.type} className="h-2.5 w-2.5" />
              {generation.type}
            </Badge>
            <Badge
              variant="secondary"
              className="rounded-full border-none bg-black/60 px-2 py-0.5 text-[10px] text-white"
            >
              {sourceLabel(source)}
            </Badge>
            <span className="text-[10px] font-medium text-white/80 drop-shadow-sm">
              {formatRelativeDate(generation.created_at)}
            </span>
          </div>

          {generation.prompt ? (
            <p className="line-clamp-2 select-none text-left text-[10px] font-medium leading-tight text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              {generation.prompt}
            </p>
          ) : (
            <span />
          )}

          <div className="pointer-events-auto flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              className="h-7 rounded-full border-none bg-white px-3 text-[10px] font-semibold text-black hover:bg-white/90"
              onClick={() => onOpen(generation)}
            >
              Select
            </Button>
          </div>
        </div>

        <div className="absolute inset-x-2 bottom-2 z-10 sm:hidden">
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-full rounded-full border-none bg-black/70 text-xs font-semibold text-white backdrop-blur"
            onClick={() => onOpen(generation)}
          >
            Select
          </Button>
        </div>
      </article>
    )
  }

  const dropdownProps = {
    canEditImage: actionVariant === "library" && generation.type === "image",
    canSaveExample: actionVariant === "library" && generation.type === "image",
    canAnimate: actionVariant === "library" && generation.type === "image",
    onEditImage: onEditImage ? () => onEditImage(generation.url) : undefined,
    onSaveExample: onSaveExample ? () => onSaveExample(generation) : undefined,
    onAnimate: onAnimate ? () => onAnimate(generation) : undefined,
    onCopy: () => onCopy(generation.url, generation.type),
    onDownload: () => onDownload(generation.url, generation.type, generation.type),
    onDelete: () => onDelete(generation),
  }

  const handleSave = () => {
    if (!onSave || !getDefaultCategoryByMediaType) return
    onSave({
      url: generation.url,
      assetType: generation.type,
      title: `${generation.type} ${generation.id.slice(0, 8)}`,
      category: getDefaultCategoryByMediaType(generation.type),
      visibility: "private",
      uploadId: source === "upload" ? generation.uploadId ?? generation.id : undefined,
      supabaseStoragePath: generation.supabase_storage_path,
      sourceGenerationId: source === "upload" ? undefined : generation.id,
      sourceNodeType: source === "upload" ? "upload" : "generation-history",
      description: generation.prompt ?? undefined,
    })
  }

  return (
    <article className="group relative aspect-square overflow-hidden rounded-2xl border border-border/70 bg-card/45 shadow-sm transition-all hover:border-foreground/20 hover:shadow-md">
      <MediaPreview
        type={generation.type}
        url={generation.url}
        alt={generation.prompt || "Generated media"}
        onOpen={generation.type === "audio" ? undefined : () => onOpen(generation)}
      />

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between bg-black/50 p-3 opacity-0 transition-opacity duration-200 sm:group-hover:opacity-100">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge
              variant="secondary"
              className="gap-1 rounded-full border-none bg-black/60 px-2 py-0.5 text-[10px] capitalize text-white"
            >
              <MediaTypeIcon type={generation.type} className="h-2.5 w-2.5" />
              {generation.type}
            </Badge>
            <Badge
              variant="secondary"
              className="rounded-full border-none bg-black/60 px-2 py-0.5 text-[10px] text-white"
            >
              {sourceLabel(source)}
            </Badge>
            <span className="text-[10px] font-medium text-white/80 drop-shadow-sm">
              {formatRelativeDate(generation.created_at)}
            </span>
          </div>

          <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-1.5">
            {actionVariant === "fanvue" && fanvueActions && supportsFanvue ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 rounded-full border-none bg-white px-2.5 text-[10px] font-semibold text-black transition-colors hover:bg-white/90"
                  onClick={() => fanvueActions.onSendToVault(generation)}
                >
                  <Vault className="mr-1 h-3.5 w-3.5" />
                  Vault
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 rounded-full border-none bg-white/15 px-2.5 text-[10px] font-semibold text-white transition-colors hover:bg-white/25"
                  onClick={() => fanvueActions.onCreatePost(generation)}
                >
                  <PaperPlaneTilt className="mr-1 h-3.5 w-3.5" />
                  Post
                </Button>
              </>
            ) : null}

            {actionVariant === "library" && onSave && getDefaultCategoryByMediaType ? (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 rounded-full border-none bg-white px-2.5 text-[10px] font-semibold text-black transition-colors hover:bg-white/90"
                  onClick={handleSave}
                >
                  <Heart className="mr-1 h-3.5 w-3.5" weight="fill" />
                  Save
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 w-7 rounded-full border-none bg-white/15 p-0 text-white transition-colors hover:bg-white/25"
                  onClick={() => onDownload(generation.url, generation.type, generation.type)}
                  title="Download"
                >
                  <DownloadSimple className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="h-7 w-7 rounded-full border-none bg-white/15 p-0 text-white transition-colors hover:bg-white/25"
                onClick={() => onDownload(generation.url, generation.type, generation.type)}
                title="Download"
              >
                <DownloadSimple className="h-3.5 w-3.5" />
              </Button>
            )}

            <CardDropdownActions
              {...dropdownProps}
              className="h-7 w-7 rounded-full border-none bg-white/15 text-white transition-colors hover:bg-white/25"
            />
          </div>
        </div>

        {generation.prompt ? (
          <p className="line-clamp-1 select-none text-left text-[10px] font-medium leading-tight text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {generation.prompt}
          </p>
        ) : null}
      </div>

      <div className="absolute bottom-2 right-2 z-10 sm:hidden">
        <CardDropdownActions
          {...dropdownProps}
          className="h-8 w-8 rounded-full border border-white/10 bg-black/60 text-white backdrop-blur hover:bg-black/85"
        />
      </div>

      {actionVariant === "fanvue" && fanvueActions && supportsFanvue ? (
        <div className="absolute bottom-2 left-2 z-10 flex gap-1 sm:hidden">
          <Button
            type="button"
            size="sm"
            className="h-7 rounded-full bg-white px-2 text-[10px] font-semibold text-black"
            onClick={() => fanvueActions.onSendToVault(generation)}
          >
            <Vault className="mr-1 h-3 w-3" />
            Vault
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 rounded-full bg-black/60 px-2 text-[10px] font-semibold text-white backdrop-blur"
            onClick={() => fanvueActions.onCreatePost(generation)}
          >
            <PaperPlaneTilt className="mr-1 h-3 w-3" />
            Post
          </Button>
        </div>
      ) : null}
    </article>
  )
}
