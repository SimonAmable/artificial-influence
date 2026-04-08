"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Stack } from "@phosphor-icons/react"
import { Card } from "@/components/ui/card"
import type { BrandKit } from "@/lib/brand-kit/types"
import { cn } from "@/lib/utils"

export type BrandKitCardProps = {
  kit: BrandKit
  className?: string
}

export function BrandKitCard({ kit, className }: BrandKitCardProps) {
  const thumb = kit.logoUrl ?? kit.iconUrl
  const updated = new Date(kit.updatedAt)
  const updatedLabel = Number.isNaN(updated.getTime())
    ? ""
    : updated.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })

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
          <p className="text-lg font-medium text-foreground">{kit.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {kit.isDefault ? "Default kit" : "Brand kit"}
            {updatedLabel ? ` · ${updatedLabel}` : ""}
          </p>
        </div>
      </Card>
    </Link>
  )
}
