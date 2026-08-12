"use client"

import * as React from "react"
import Link from "next/link"
import { CircleNotch, UploadSimple, User } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import type { AssetRecord } from "@/lib/assets/types"
import { getCharacterAssetPreviewUrl } from "@/lib/extension/character-asset"
import { cn } from "@/lib/utils"

const NONE_VALUE = "__none__"
const UPLOAD_VALUE = "__upload__"

type CharacterAvatarProps = {
  src?: string | null
  alt: string
  size?: "sm" | "md"
  flush?: boolean
  className?: string
}

function CharacterAvatar({ src, alt, size = "md", flush = false, className }: CharacterAvatarProps) {
  const dimension = size === "sm" ? "size-7" : "size-9"

  if (flush) {
    return (
      <span
        className={cn(
          "inline-flex size-10 shrink-0 overflow-hidden rounded-l-2xl bg-muted text-muted-foreground",
          className,
        )}
      >
        {src ? (
          <img src={src} alt={alt} className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center">
            <User className="size-4" weight="bold" />
          </span>
        )}
      </span>
    )
  }

  if (!src) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-inset ring-border/60",
          dimension,
          className,
        )}
      >
        <User className={size === "sm" ? "size-3.5" : "size-4"} weight="bold" />
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn("shrink-0 rounded-full object-cover ring-1 ring-inset ring-border/60", dimension, className)}
    />
  )
}

type ExtensionCharacterSelectProps = {
  characters: AssetRecord[]
  loading?: boolean
  error?: string | null
  selectedAssetId: string | null
  selectedUploadUrl: string | null
  optional?: boolean
  disabled?: boolean
  className?: string
  onAssetSelect: (asset: AssetRecord) => void
  onUpload: (file: File) => void
  onClear: () => void
}

export function ExtensionCharacterSelect({
  characters,
  loading = false,
  error = null,
  selectedAssetId,
  selectedUploadUrl,
  optional = false,
  disabled = false,
  className,
  onAssetSelect,
  onUpload,
  onClear,
}: ExtensionCharacterSelectProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const selectedAsset = React.useMemo(
    () => characters.find((character) => character.id === selectedAssetId) ?? null,
    [characters, selectedAssetId],
  )

  const selectValue =
    selectedAssetId ?? (selectedUploadUrl ? UPLOAD_VALUE : optional ? NONE_VALUE : undefined)

  const handleValueChange = (value: string) => {
    if (value === NONE_VALUE) {
      onClear()
      return
    }

    if (value === UPLOAD_VALUE) {
      return
    }

    const asset = characters.find((character) => character.id === value)
    if (asset) {
      onAssetSelect(asset)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file?.type.startsWith("image/")) return
    onUpload(file)
    event.target.value = ""
  }

  const triggerLabel = selectedAsset
    ? selectedAsset.title
    : selectedUploadUrl
      ? "Uploaded image"
      : optional
        ? "No character"
        : "Select character"

  const triggerPreview = selectedAsset
    ? getCharacterAssetPreviewUrl(selectedAsset)
    : selectedUploadUrl

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Select
        value={selectValue}
        onValueChange={handleValueChange}
        disabled={disabled || loading}
      >
        <SelectTrigger className="h-10 w-full overflow-hidden rounded-2xl py-0 pl-0 pr-2">
          <span className="flex min-w-0 flex-1 items-center">
            {loading ? (
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-l-2xl bg-muted">
                <CircleNotch className="size-4 animate-spin text-muted-foreground" />
              </span>
            ) : (
              <CharacterAvatar src={triggerPreview} alt={triggerLabel} flush />
            )}
            <span className="min-w-0 flex-1 px-2.5 text-left">
              <span className="block truncate text-sm font-medium text-foreground">{triggerLabel}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {selectedAsset ? "Saved character asset" : selectedUploadUrl ? "Session upload" : "From your library"}
              </span>
            </span>
          </span>
        </SelectTrigger>

        <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)]">
          {optional ? (
            <SelectItem value={NONE_VALUE} className="py-2">
              <span className="flex items-center gap-2.5">
                <CharacterAvatar alt="No character" size="sm" />
                <span className="text-sm">No character</span>
              </span>
            </SelectItem>
          ) : null}

          {characters.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {error ? error : "No character assets yet."}{" "}
              <Link href="/ai-influencer" className="font-medium text-foreground underline-offset-2 hover:underline">
                Create one
              </Link>
            </div>
          ) : (
            characters.map((character) => (
              <SelectItem key={character.id} value={character.id} className="py-2">
                <span className="flex min-w-0 items-center gap-2.5">
                  <CharacterAvatar
                    src={getCharacterAssetPreviewUrl(character)}
                    alt={character.title}
                    size="sm"
                  />
                  <span className="min-w-0 truncate text-sm">{character.title}</span>
                </span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 flex-1 gap-1.5 rounded-2xl text-xs"
          disabled={disabled || loading}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadSimple className="size-3.5" weight="bold" />
          Upload
        </Button>
        {selectedAssetId || selectedUploadUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-2xl px-3 text-xs text-muted-foreground"
            disabled={disabled}
            onClick={onClear}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  )
}
