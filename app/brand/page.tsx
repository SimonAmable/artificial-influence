"use client"

import * as React from "react"
import { Plus } from "@phosphor-icons/react"
import { BrandKitCard } from "@/components/brand-kit/brand-kit-card"
import { BrandKitNewFlowDialog } from "@/components/brand-kit/brand-kit-new-flow-dialog"
import { Button } from "@/components/ui/button"
import type { BrandKit } from "@/lib/brand-kit/types"

export default function BrandHubPage() {
  const [kits, setKits] = React.useState<BrandKit[]>([])
  const [loading, setLoading] = React.useState(true)
  const [newFlowOpen, setNewFlowOpen] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/brand-kits")
        if (!res.ok) {
          if (!cancelled) setKits([])
          return
        }
        const data = (await res.json()) as { kits: BrandKit[] }
        if (!cancelled) setKits(data.kits ?? [])
      } catch {
        if (!cancelled) setKits([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-16 text-foreground md:px-6 md:pt-20">
      <div className="mx-auto max-w-5xl">
        <section>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <h1 className="font-serif text-2xl italic tracking-tight text-foreground md:text-3xl">Brand kits</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Logos, colors, type, and voice in one place. Open a kit to edit it, or create a new one—blank or from a website.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setNewFlowOpen(true)}
              className="shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              New brand kit
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={`sk-${i}`}
                    className="h-56 animate-pulse rounded-2xl border border-border bg-muted/40"
                  />
                ))
              : kits.length === 0 ? (
                  <p className="col-span-full rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
                    No kits yet. Create a brand kit to get started—manually or from a website.
                  </p>
                )
              : kits.map((kit) => (
                  <BrandKitCard
                    key={kit.id}
                    kit={kit}
                    onDeleted={(id) => setKits((prev) => prev.filter((item) => item.id !== id))}
                  />
                ))}
          </div>
        </section>
      </div>

      <BrandKitNewFlowDialog open={newFlowOpen} onOpenChange={setNewFlowOpen} />
    </div>
  )
}
