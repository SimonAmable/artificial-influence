"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus } from "@phosphor-icons/react"
import { toast } from "sonner"

import { DashboardAgentPromptBox } from "@/components/dashboard/dashboard-agent-prompt-box"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { saveDashboardAgentHandoff } from "@/lib/chat/dashboard-agent-handoff"
import type { AttachedRef } from "@/lib/commands/types"
import { DEFAULT_CHAT_GATEWAY_MODEL } from "@/lib/constants/chat-llm-models"
import {
  applyCharacterMention,
  fetchDashboardCharacters,
  getCharacterDisplayName,
  prependCharacterMentions,
  type DashboardCharacterItem,
} from "@/lib/guides/character-mention"
import type { GuidePromptTry } from "@/lib/guides/types"
import { influencerModeHref } from "@/lib/ai-influencer/modes"
import { cn } from "@/lib/utils"

const DEFAULT_SUBMIT_HREF = "/chat"
const CREATE_CHARACTER_HREF = influencerModeHref("direct")

export function GuidePromptTrySection({ promptTry }: { promptTry: GuidePromptTry }) {
  const router = useRouter()
  const tabs = promptTry.tabs
  const firstTab = tabs[0]

  const [activeTabId, setActiveTabId] = React.useState(firstTab?.id ?? "")
  const [promptValue, setPromptValue] = React.useState(firstTab?.prompt ?? "")
  const [attachedRefs, setAttachedRefs] = React.useState<AttachedRef[]>([])
  const [selectedModelId, setSelectedModelId] = React.useState<string>(DEFAULT_CHAT_GATEWAY_MODEL)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const [characters, setCharacters] = React.useState<DashboardCharacterItem[]>([])
  const [charactersLoading, setCharactersLoading] = React.useState(true)
  const [selectedCharacterId, setSelectedCharacterId] = React.useState<string | null>(null)
  const [characterRefId, setCharacterRefId] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const items = await fetchDashboardCharacters()
        if (!mounted) return
        setCharacters(items)

        const mostRecent = items[0]
        if (mostRecent) {
          const result = applyCharacterMention({
            character: mostRecent,
            promptValue: firstTab?.prompt ?? "",
            attachedRefs: [],
            previousCharacterRefId: null,
          })
          setSelectedCharacterId(mostRecent.id)
          setCharacterRefId(result.characterRefId)
          setPromptValue(result.promptValue)
          setAttachedRefs(result.attachedRefs)
        }
      } catch (error) {
        console.error("Failed to load guide characters", error)
      } finally {
        if (mounted) setCharactersLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
    // Prefill once on mount with the newest character + first scene brief.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot load
  }, [])

  const handleTabChange = React.useCallback(
    (nextId: string) => {
      const next = tabs.find((tab) => tab.id === nextId)
      if (!next) return
      setActiveTabId(next.id)
      setPromptValue(prependCharacterMentions(next.prompt, attachedRefs, characterRefId))
    },
    [attachedRefs, characterRefId, tabs]
  )

  const handleSelectCharacter = React.useCallback(
    (item: DashboardCharacterItem) => {
      const result = applyCharacterMention({
        character: item,
        promptValue,
        attachedRefs,
        previousCharacterRefId: characterRefId,
      })
      setSelectedCharacterId(item.id)
      setCharacterRefId(result.characterRefId)
      setPromptValue(result.promptValue)
      setAttachedRefs(result.attachedRefs)
    },
    [attachedRefs, characterRefId, promptValue]
  )

  const handoffAndOpen = React.useCallback(
    (hrefBase: string) => {
      if (!selectedCharacterId) {
        toast.error("Pick a character above first")
        return
      }

      const trimmedPrompt = promptValue.trim()
      if (!trimmedPrompt && attachedRefs.length === 0) {
        toast.error("Enter a prompt to continue")
        return
      }

      setIsSubmitting(true)
      saveDashboardAgentHandoff({
        prompt: trimmedPrompt,
        attachedRefs,
        model: selectedModelId,
      })

      const href = hrefBase.includes("?")
        ? `${hrefBase}&new=${Date.now()}`
        : `${hrefBase}?new=${Date.now()}`
      router.push(href)
    },
    [attachedRefs, promptValue, router, selectedCharacterId, selectedModelId]
  )

  const submitHref = promptTry.submitHref ?? DEFAULT_SUBMIT_HREF

  if (tabs.length === 0) return null

  return (
    <section className="flex flex-col gap-4 border-t border-border/70 pt-8">
      <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {promptTry.heading ?? "Try a week brief"}
      </h2>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">Working with</p>
        <div className="w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2 touch-pan-x pb-0.5">
            <Link
              href={CREATE_CHARACTER_HREF}
              className={cn(
                "flex aspect-square w-[80px] shrink-0 flex-col items-center justify-center rounded-xl border border-dashed p-2 transition-all sm:w-[88px]",
                "border-primary/45 bg-primary/5 hover:border-primary/60 hover:bg-primary/10"
              )}
            >
              <Plus className="mb-1 size-4 text-primary" weight="bold" />
              <span className="text-[10px] font-bold tracking-tight">Create</span>
            </Link>

            {charactersLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`guide-character-skeleton-${index}`}
                    className="aspect-square w-[80px] shrink-0 animate-pulse rounded-xl border border-border/30 bg-secondary/10 sm:w-[88px]"
                  />
                ))
              : null}

            {!charactersLoading && characters.length === 0 ? (
              <div className="flex min-h-[80px] min-w-[12rem] flex-1 items-center rounded-xl border border-dashed border-border/50 bg-muted/20 px-3 text-xs text-muted-foreground sm:min-h-[88px]">
                No locked face yet — create one to use as an @ reference.
              </div>
            ) : null}

            {!charactersLoading
              ? characters.map((item) => {
                  const isSelected = selectedCharacterId === item.id
                  const name = getCharacterDisplayName(item)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectCharacter(item)}
                      aria-pressed={isSelected}
                      className={cn(
                        "group relative flex aspect-square w-[80px] shrink-0 flex-col justify-end overflow-hidden rounded-xl border p-2 text-left transition-all sm:w-[88px]",
                        isSelected
                          ? "border-foreground ring-2 ring-foreground/80"
                          : "border-border/30 bg-secondary/10 hover:bg-secondary/20"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={name}
                        className="absolute inset-0 size-full object-cover object-center transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/35 to-transparent p-2 pt-4" />
                      <span className="relative z-10 max-w-full truncate text-[10px] font-black uppercase tracking-[-0.03em] text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]">
                        {name}
                      </span>
                    </button>
                  )
                })
              : null}
          </div>
        </div>
      </div>

      <Tabs
        value={activeTabId}
        onValueChange={handleTabChange}
        className="items-center gap-4"
      >
        <TabsList
          variant="default"
          className="mx-auto flex h-auto w-fit max-w-full flex-wrap justify-center gap-0.5"
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="rounded-full px-3 py-1.5 text-xs sm:text-sm"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DashboardAgentPromptBox
        promptValue={promptValue}
        onPromptChange={setPromptValue}
        attachedRefs={attachedRefs}
        onAttachedRefsChange={(nextRefs) => {
          setAttachedRefs(nextRefs)
          if (characterRefId && !nextRefs.some((ref) => ref.id === characterRefId)) {
            setCharacterRefId(null)
            setSelectedCharacterId(null)
          }
        }}
        selectedModelId={selectedModelId}
        onModelChange={setSelectedModelId}
        onSubmit={() => handoffAndOpen(submitHref)}
        onOpenFullAgent={() => handoffAndOpen(submitHref)}
        isSubmitting={isSubmitting}
      />
    </section>
  )
}
