"use client"

import * as React from "react"
import { PaperPlaneTilt, Vault } from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  FanvueImageActionDialog,
  type FanvueImageActionMode,
} from "@/components/content/fanvue-image-action-dialog"
import { Button } from "@/components/ui/button"
import type { GuideFanvueTry } from "@/lib/guides/types"
import { cn } from "@/lib/utils"

type KeeperItem = {
  id: string
  url: string
}

export function GuideFanvueTrySection({ tryBlock }: { tryBlock: GuideFanvueTry }) {
  const [keepers, setKeepers] = React.useState<KeeperItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedUrl, setSelectedUrl] = React.useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogMode, setDialogMode] = React.useState<FanvueImageActionMode>("post")

  React.useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const response = await fetch("/api/generations?limit=12")
        if (!response.ok) throw new Error("Failed to load media")
        const data = (await response.json()) as {
          generations?: Array<{ id: string; url?: string | null }>
        }
        const items = (data.generations ?? [])
          .map((gen) => ({
            id: gen.id,
            url: typeof gen.url === "string" ? gen.url : "",
          }))
          .filter((item) => item.url.length > 0)
        if (!mounted) return
        setKeepers(items)
        setSelectedUrl(items[0]?.url ?? null)
      } catch (error) {
        console.error("Failed to load Fanvue guide keepers", error)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const openAction = React.useCallback(
    (mode: FanvueImageActionMode) => {
      if (!selectedUrl) {
        toast.error("Pick a keeper first")
        return
      }
      setDialogMode(mode)
      setDialogOpen(true)
    },
    [selectedUrl]
  )

  return (
    <section className="flex flex-col gap-4 border-t border-border/70 pt-8">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {tryBlock.heading ?? "Try it with a keeper"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {tryBlock.description ??
            "Pick a still from your history, then create a Fanvue post or upload it to your vault."}
        </p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5">
        <p className="mb-3 text-xs font-medium text-muted-foreground">Pick a keeper</p>
        <div className="w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2 touch-pan-x pb-0.5">
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={`fanvue-keeper-skeleton-${index}`}
                    className="aspect-square w-20 shrink-0 animate-pulse rounded-xl border border-border/30 bg-secondary/10 sm:w-22"
                  />
                ))
              : null}

            {!loading && keepers.length === 0 ? (
              <div className="flex min-h-20 min-w-56 flex-1 items-center rounded-xl border border-dashed border-border/50 bg-muted/20 px-3 text-xs text-muted-foreground sm:min-h-22">
                No keepers yet. Shoot a week of content first, then come back.
              </div>
            ) : null}

            {!loading
              ? keepers.map((item) => {
                  const isSelected = selectedUrl === item.url
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedUrl(item.url)}
                      aria-pressed={isSelected}
                      className={cn(
                        "relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl border transition-all sm:w-22",
                        isSelected
                          ? "border-foreground ring-2 ring-foreground/80"
                          : "border-border/30 hover:border-border"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt="" className="size-full object-cover object-top" />
                    </button>
                  )
                })
              : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="lg"
            disabled={!selectedUrl}
            onClick={() => openAction("post")}
          >
            <PaperPlaneTilt data-icon="inline-start" className="size-4" weight="bold" />
            Create Fanvue post
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={!selectedUrl}
            onClick={() => openAction("vault")}
          >
            <Vault data-icon="inline-start" className="size-4" weight="bold" />
            Upload to vault
          </Button>
        </div>
      </div>

      <FanvueImageActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        imageUrl={selectedUrl}
      />
    </section>
  )
}
