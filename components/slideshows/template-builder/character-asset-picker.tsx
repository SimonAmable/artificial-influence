"use client"

import * as React from "react"
import { User, X } from "@phosphor-icons/react"
import {
  AssetSelectionModal,
  type AssetSelectionPick,
} from "@/components/shared/modals/asset-selection-modal"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type CharacterAssetSelection = {
  assetId: string
  previewUrl: string
  title?: string
}

export function CharacterAssetPicker({
  value,
  onChange,
  label = "Character",
  className,
}: {
  value: CharacterAssetSelection | null
  onChange: (value: CharacterAssetSelection | null) => void
  label?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)

  function handleSelect(pick: AssetSelectionPick) {
    if (!pick.id) return
    onChange({
      assetId: pick.id,
      previewUrl: pick.previewUrl || pick.url,
      title: pick.title,
    })
    setOpen(false)
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {value ? (
        <div className="flex items-center gap-3 rounded-2xl bg-muted/15 p-3 ring-1 ring-inset ring-border/40">
          <img
            src={value.previewUrl}
            alt={value.title || "Character reference"}
            className="h-14 w-14 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.title || "Character asset"}</p>
            <p className="text-xs text-muted-foreground">Saved character reference</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            Change
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(null)}
            aria-label="Remove character"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-full gap-2" onClick={() => setOpen(true)}>
          <User className="h-4 w-4" weight="regular" />
          Select character
        </Button>
      )}

      <AssetSelectionModal
        open={open}
        onOpenChange={setOpen}
        onSelect={handleSelect}
        presetCategory="character"
        allowedAssetTypes={["image"]}
        defaultTab="assets"
      />
    </div>
  )
}
