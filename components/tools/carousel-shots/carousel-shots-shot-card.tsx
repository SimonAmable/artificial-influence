"use client"

import * as React from "react"
import { CircleNotch, DotsThreeVertical } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { CarouselShotRecord } from "@/lib/carousel-shots/types"
import { cn } from "@/lib/utils"

type CarouselShotsShotCardProps = {
  isSelected: boolean
  isUpscaling: boolean
  onDownload: () => void
  onOpen: () => void
  onSelectChange: (selected: boolean) => void
  onUpscale: () => void
  onUpscaleAndDownload: () => void
  selectMode: boolean
  shot: CarouselShotRecord
}

export function CarouselShotsShotCard({
  isSelected,
  isUpscaling,
  onDownload,
  onOpen,
  onSelectChange,
  onUpscale,
  onUpscaleAndDownload,
  selectMode,
  shot,
}: CarouselShotsShotCardProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-1 transition-transform duration-200",
        selectMode && "origin-center scale-90",
      )}
    >
      <div
        className={cn(
          "group relative min-h-0 flex-1 overflow-hidden rounded-xl border bg-muted/20",
          selectMode && "cursor-pointer",
          selectMode && isSelected && "ring-2 ring-primary",
        )}
      >
        <button
          type="button"
          className="absolute inset-0 z-10"
          onClick={() => {
            if (selectMode) {
              onSelectChange(!isSelected)
              return
            }
            onOpen()
          }}
          aria-label={
            selectMode
              ? `${isSelected ? "Deselect" : "Select"} shot ${shot.index + 1}`
              : `Open shot ${shot.index + 1}`
          }
          aria-pressed={selectMode ? isSelected : undefined}
        />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shot.upscaledUrl ?? shot.url}
          alt={`Carousel shot ${shot.index + 1}`}
          className="h-full w-full object-contain"
        />

        {shot.upscaledUrl ? (
          <Badge className="absolute right-2 top-2 z-20" variant="secondary">
            HD
          </Badge>
        ) : null}

        {selectMode ? (
          <div className="pointer-events-none absolute left-2 top-2 z-20">
            <Checkbox
              checked={isSelected}
              aria-hidden
              tabIndex={-1}
              aria-label={`Select shot ${shot.index + 1}`}
            />
          </div>
        ) : null}

        {isUpscaling ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/70">
            <CircleNotch className="size-6 animate-spin text-primary" />
          </div>
        ) : null}

        {!selectMode ? (
          <div className="absolute bottom-2 right-2 z-20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="size-8 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 data-[state=open]:opacity-100"
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`Actions for shot ${shot.index + 1}`}
                >
                  <DotsThreeVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                <DropdownMenuItem onClick={onDownload}>Download</DropdownMenuItem>
                <DropdownMenuItem onClick={onUpscale}>Upscale</DropdownMenuItem>
                <DropdownMenuItem onClick={onUpscaleAndDownload}>Upscale & Download</DropdownMenuItem>
                <DropdownMenuItem onClick={onOpen}>Open preview</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>
      <p className="shrink-0 text-center text-xs text-muted-foreground">Shot {shot.index + 1}</p>
    </div>
  )
}
