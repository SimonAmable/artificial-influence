"use client"

import {
  Copy,
  DotsThreeVertical,
  DownloadSimple,
  PencilSimple,
  Play,
  Sparkle,
  SquaresFour,
  Trash,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function CardDropdownActions({
  canEditAsset = false,
  canEditImage = false,
  canDelete = true,
  canSaveExample = false,
  canAnimate = false,
  canCreateShotVariations = false,
  onEditAsset,
  onEditImage,
  onSaveExample,
  onAnimate,
  onCreateShotVariations,
  onCopy,
  onDownload,
  onDelete,
  className,
}: {
  canEditAsset?: boolean
  canEditImage?: boolean
  canDelete?: boolean
  canSaveExample?: boolean
  canAnimate?: boolean
  canCreateShotVariations?: boolean
  onEditAsset?: () => void
  onEditImage?: () => void
  onSaveExample?: () => void
  onAnimate?: () => void
  onCreateShotVariations?: () => void
  onCopy: () => void
  onDownload: () => void
  onDelete: () => void
  className?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("h-8 w-8", className)}>
          <DotsThreeVertical className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEditAsset && onEditAsset ? (
          <DropdownMenuItem onClick={onEditAsset}>
            <PencilSimple className="mr-2 h-4 w-4" />
            Edit asset
          </DropdownMenuItem>
        ) : null}
        {canEditImage && onEditImage ? (
          <DropdownMenuItem onClick={onEditImage}>
            <PencilSimple className="mr-2 h-4 w-4" />
            Edit image
          </DropdownMenuItem>
        ) : null}
        {canSaveExample && onSaveExample ? (
          <DropdownMenuItem onClick={onSaveExample}>
            <Sparkle className="mr-2 h-4 w-4" weight="regular" />
            Save Example
          </DropdownMenuItem>
        ) : null}
        {canAnimate && onAnimate ? (
          <DropdownMenuItem onClick={onAnimate}>
            <Play className="mr-2 h-4 w-4" weight="fill" />
            Animate
          </DropdownMenuItem>
        ) : null}
        {canCreateShotVariations && onCreateShotVariations ? (
          <DropdownMenuItem onClick={onCreateShotVariations}>
            <SquaresFour className="mr-2 h-4 w-4" />
            Create Shot Variations
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={onCopy}>
          <Copy className="mr-2 h-4 w-4" />
          Copy
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDownload}>
          <DownloadSimple className="mr-2 h-4 w-4" />
          Download
        </DropdownMenuItem>
        {canDelete ? (
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
