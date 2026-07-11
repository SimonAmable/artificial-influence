"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Users } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CharacterItem = {
  id: string
  url: string
  prompt: string | null
  displayName?: string | null
}

function getCharacterDisplayName(item: CharacterItem): string {
  const explicitName = item.displayName?.trim()
  if (explicitName) return explicitName

  const prompt = item.prompt?.trim()
  if (!prompt) return "Saved Character"

  try {
    const parsed = JSON.parse(prompt) as Record<string, unknown>
    for (const key of ["displayName", "displayname", "character_name", "title", "name", "subject", "main_subject"]) {
      const value = parsed[key]
      if (typeof value === "string" && value.trim()) return value.trim()
    }
  } catch {
    // Fall through to prompt heuristics.
  }

  const namedMatch = prompt.match(/named\s+([^.,]+?)(?:\.|,|$)/i)
  if (namedMatch?.[1]) return namedMatch[1].trim()

  if (prompt.length <= 24) return prompt

  return prompt.split(".")[0]?.trim() || "Saved Character"
}

export function CharactersSection() {
  const router = useRouter()
  const [characters, setCharacters] = React.useState<CharacterItem[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        const [generationsResponse, assetsResponse] = await Promise.all([
          fetch(`/api/generations?tool=ai_influencer&limit=30`),
          fetch(`/api/assets?category=character&limit=100`),
        ])
        if (!generationsResponse.ok) throw new Error("Failed to fetch characters")
        if (!assetsResponse.ok) throw new Error("Failed to fetch character assets")

        const [generationData, assetData] = await Promise.all([
          generationsResponse.json(),
          assetsResponse.json(),
        ])

        const characterAssets = Array.isArray(assetData.assets)
          ? (assetData.assets as Array<{
              title?: string
              sourceGenerationId?: string | null
              url?: string
            }>)
          : []

        const assetTitleByGenerationId = new Map(
          characterAssets
            .filter(
              (asset) =>
                typeof asset.sourceGenerationId === "string" &&
                asset.sourceGenerationId.trim().length > 0
            )
            .map(
              (asset) =>
                [
                  asset.sourceGenerationId as string,
                  typeof asset.title === "string" ? asset.title : null,
                ] as const
            )
            .filter(([, title]) => typeof title === "string" && title.trim().length > 0)
        )
        const assetTitleByUrl = new Map(
          characterAssets
            .filter((asset) => typeof asset.url === "string" && asset.url.trim().length > 0)
            .map(
              (asset) =>
                [asset.url as string, typeof asset.title === "string" ? asset.title : null] as const
            )
            .filter(([, title]) => typeof title === "string" && title.trim().length > 0)
        )

        const parsed: CharacterItem[] = (generationData.generations || [])
          .map(
            (gen: {
              id: string
              url: string
              prompt: string | null
            }) => ({
              id: gen.id,
              url: gen.url,
              prompt: gen.prompt,
              displayName:
                assetTitleByGenerationId.get(gen.id) || assetTitleByUrl.get(gen.url) || null,
            })
          )
          .filter(
            (item: CharacterItem) => typeof item.url === "string" && item.url.length > 0
          )

        if (isMounted) setCharacters(parsed)
      } catch (error) {
        console.error("Failed to load characters", error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    void load()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <section className="mx-auto w-full pb-4 pt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <h2 className="text-2xl font-semibold">Characters</h2>
          <Badge
            variant="secondary"
            className="bg-secondary/45 text-muted-foreground border-border/30 text-[10px] font-bold px-1.5 py-0.5"
          >
            {loading ? "—" : characters.length}
          </Badge>
        </div>
        <Button asChild size="lg" variant="ghost" className="shadow-md transition-shadow hover:shadow-lg">
          <Link href="/ai-influencer">
            <Users size={18} weight="bold" className="mr-2" />
            Characters
          </Link>
        </Button>
      </div>

      <div className="w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2.5 touch-pan-x pb-1">
          <button
            type="button"
            onClick={() => router.push("/ai-influencer")}
            className={cn(
              "flex shrink-0 flex-col items-center justify-center p-3 rounded-xl border border-dashed aspect-square w-[96px] sm:w-[108px] transition-all",
              "border-primary/45 bg-primary/5 hover:bg-primary/10 hover:border-primary/60"
            )}
          >
            <Plus className="size-4 text-primary mb-1" weight="bold" />
            <span className="text-[10px] font-bold tracking-tight">Create new</span>
          </button>

          {loading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`character-skeleton-${index}`}
                  className="shrink-0 aspect-square w-[96px] sm:w-[108px] rounded-xl border border-border/30 bg-secondary/10 animate-pulse"
                />
              ))
            : characters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push("/ai-influencer")}
                  className="group relative flex shrink-0 flex-col justify-end p-2 rounded-xl border border-border/30 bg-secondary/10 hover:bg-secondary/20 cursor-pointer transition-all aspect-square w-[96px] sm:w-[108px] overflow-hidden text-left"
                >
                  <img
                    src={item.url}
                    alt={item.prompt || "Character"}
                    className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-102 transition-transform"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent h-1/2 p-2 pt-4 flex items-end" />
                  <span className="relative z-10 truncate max-w-full text-[10px] font-black uppercase tracking-[-0.03em] text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]">
                    {getCharacterDisplayName(item)}
                  </span>
                </button>
              ))}
        </div>
      </div>
    </section>
  )
}
