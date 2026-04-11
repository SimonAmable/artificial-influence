"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { DotsThree, Stack, Trash } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BrandKit } from "@/lib/brand-kit/types"
import { cn } from "@/lib/utils"

export type BrandKitCardProps = {
  kit: BrandKit
  className?: string
  onDeleted?: (id: string) => void
}

export function BrandKitCard({ kit, className, onDeleted }: BrandKitCardProps) {
  const thumb = kit.logoUrl ?? kit.iconUrl
  const updated = new Date(kit.updatedAt)
  const updatedLabel = Number.isNaN(updated.getTime())
    ? ""
    : updated.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  const [deleting, setDeleting] = React.useState(false)

  const handleDelete = async (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    if (deleting) return
    const ok = window.confirm(`Delete "${kit.name}"? This cannot be undone.`)
    if (!ok) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/brand-kits/${kit.id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Delete failed")
      }
      toast.success("Brand kit deleted")
      onDeleted?.(kit.id)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Link href={`/brand/${kit.id}`} className={cn("group block", className)}>
      <Card className="h-full overflow-hidden border-border bg-background text-foreground transition hover:border-primary/40 hover:shadow-lg hover:ring-1 hover:ring-primary/25">
        <div className="relative flex h-40 w-full flex-col overflow-hidden rounded-t-2xl px-4">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-background">
            {thumb ? (
              <Image src={thumb} alt="" fill className="object-contain p-6" unoptimized />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Stack size={36} weight="thin" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
          </div>
        </div>
        <div className="px-5 pb-5 pt-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-lg font-medium text-foreground">{kit.name}</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={deleting}
                  className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  aria-label="More actions"
                >
                  <DotsThree className="h-4 w-4" weight="bold" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => void handleDelete(e)}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {kit.isDefault ? "Default kit" : "Brand kit"}
            {updatedLabel ? ` · ${updatedLabel}` : ""}
          </p>
        </div>
      </Card>
    </Link>
  )
}
