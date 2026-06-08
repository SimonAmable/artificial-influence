"use client"

import * as React from "react"
import { CircleNotch, FilePlus, FolderOpen, Plus, User, X } from "@phosphor-icons/react"
import { toast } from "sonner"
import {
  AssetSelectionModal,
  type AssetSelectionPick,
} from "@/components/shared/modals/asset-selection-modal"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import type { CharacterAssetSelection } from "@/components/slideshows/template-builder/character-asset-picker"
import type { SlideshowReferenceImage } from "@/lib/slideshows/types"
import { cn } from "@/lib/utils"

const MAX_REFERENCE_IMAGES = 8

type PreviewItem =
  | { key: string; kind: "character"; url: string; title?: string }
  | { key: string; kind: "reference"; index: number; url: string; title?: string }

export function GenerationPromptField({
  label = "Generation prompt",
  prompt,
  onPromptChange,
  placeholder,
  references,
  onReferencesChange,
  characterReference,
  onCharacterReferenceChange,
  className,
}: {
  label?: string
  prompt: string
  onPromptChange: (value: string) => void
  placeholder?: string
  references: SlideshowReferenceImage[]
  onReferencesChange: (references: SlideshowReferenceImage[]) => void
  characterReference?: CharacterAssetSelection | null
  onCharacterReferenceChange?: (value: CharacterAssetSelection | null) => void
  className?: string
}) {
  const [assetModalOpen, setAssetModalOpen] = React.useState(false)
  const [characterModalOpen, setCharacterModalOpen] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const previewItems = React.useMemo<PreviewItem[]>(() => {
    const items: PreviewItem[] = []
    if (characterReference) {
      items.push({
        key: "character",
        kind: "character",
        url: characterReference.previewUrl,
        title: characterReference.title,
      })
    }
    references.forEach((reference, index) => {
      items.push({
        key: `reference-${reference.url}-${index}`,
        kind: "reference",
        index,
        url: reference.url,
        title: reference.title,
      })
    })
    return items
  }, [characterReference, references])

  const totalReferenceCount = previewItems.length
  const canAddMore = totalReferenceCount < MAX_REFERENCE_IMAGES

  function appendReference(reference: SlideshowReferenceImage) {
    if (!canAddMore) {
      toast.error(`You can attach up to ${MAX_REFERENCE_IMAGES} references.`)
      return
    }
    if (references.some((item) => item.url === reference.url)) {
      toast.message("That reference is already attached.")
      return
    }
    onReferencesChange([...references, reference])
  }

  function handleAssetSelect(pick: AssetSelectionPick) {
    if (pick.assetType !== "image") {
      toast.error("Reference images only — pick an image asset.")
      return
    }
    appendReference({
      assetId: pick.id ?? null,
      url: pick.previewUrl || pick.url,
      title: pick.title,
    })
    setAssetModalOpen(false)
  }

  function handleCharacterSelect(pick: AssetSelectionPick) {
    if (!pick.id || !onCharacterReferenceChange) return
    onCharacterReferenceChange({
      assetId: pick.id,
      previewUrl: pick.previewUrl || pick.url,
      title: pick.title,
    })
    setCharacterModalOpen(false)
  }

  async function handleUploadFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.")
      return
    }

    setUploading(true)
    try {
      const result = await uploadFileToSupabase(file, "asset-library")
      if (!result || result.fileType !== "image") return
      appendReference({
        assetId: null,
        url: result.url,
        title: result.fileName,
      })
    } finally {
      setUploading(false)
    }
  }

  function removeReference(index: number) {
    onReferencesChange(references.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <div className="overflow-hidden rounded-xl bg-background/50 ring-1 ring-inset ring-border/40">
        {previewItems.length > 0 ? (
          <div className="flex flex-wrap gap-2 p-2 pb-0">
            {previewItems.map((item) => (
              <div key={item.key} className="relative">
                <img
                  src={item.url}
                  alt={item.title || (item.kind === "character" ? "Character reference" : "Reference")}
                  className="h-14 w-14 rounded-lg border border-border/60 object-cover"
                />
                {item.kind === "character" ? (
                  <span className="absolute bottom-0 left-0 rounded-br-lg rounded-tl-md bg-foreground/85 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-background">
                    Character
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    if (item.kind === "character") {
                      onCharacterReferenceChange?.(null)
                      return
                    }
                    removeReference(item.index)
                  }}
                  className="absolute -right-1 -top-1 rounded-full border border-border bg-background p-0.5 text-muted-foreground shadow-sm transition hover:bg-destructive hover:text-destructive-foreground"
                  aria-label={item.kind === "character" ? "Remove character" : "Remove reference"}
                >
                  <X className="size-3" weight="bold" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <Textarea
          rows={4}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-[112px] resize-y border-0 bg-transparent px-3 py-2 shadow-none focus-visible:ring-0"
        />

        <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void handleUploadFileChange(event)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                aria-label="Attach reference"
                disabled={!canAddMore || uploading}
              >
                {uploading ? (
                  <CircleNotch className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={4}>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <FilePlus className="mr-2 size-4" />
                Upload image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAssetModalOpen(true)}>
                <FolderOpen className="mr-2 size-4" />
                Select asset
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {onCharacterReferenceChange ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full px-3 text-xs"
              onClick={() => setCharacterModalOpen(true)}
            >
              {characterReference ? (
                <>
                  <img
                    src={characterReference.previewUrl}
                    alt=""
                    className="h-4 w-4 rounded-full object-cover"
                  />
                  Change character
                </>
              ) : (
                <>
                  <User className="h-3.5 w-3.5" weight="duotone" />
                  Select character
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>

      <AssetSelectionModal
        open={assetModalOpen}
        onOpenChange={setAssetModalOpen}
        onSelect={handleAssetSelect}
        allowedAssetTypes={["image"]}
        defaultTab="assets"
      />

      {onCharacterReferenceChange ? (
        <AssetSelectionModal
          open={characterModalOpen}
          onOpenChange={setCharacterModalOpen}
          onSelect={handleCharacterSelect}
          presetCategory="character"
          allowedAssetTypes={["image"]}
          defaultTab="assets"
        />
      ) : null}
    </div>
  )
}
