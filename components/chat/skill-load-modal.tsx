"use client"

import * as React from "react"
import { Books, CircleNotch, DotsThreeVertical, PencilSimple } from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { SkillEditModal, type EditableSkill } from "@/components/chat/skill-edit-modal"
import type { SkillPickerEntry } from "@/lib/chat/skills/catalog"

export type SkillLoadModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after user picks a skill; parent sends the user message and closes the modal. */
  onRequestLoad: (slug: string) => void | Promise<void>
  disabled?: boolean
}

export function SkillLoadModal({
  open,
  onOpenChange,
  onRequestLoad,
  disabled = false,
}: SkillLoadModalProps) {
  const [skills, setSkills] = React.useState<SkillPickerEntry[]>([])
  const [loading, setLoading] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [sendingSlug, setSendingSlug] = React.useState<string | null>(null)
  const [editingSlug, setEditingSlug] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false
    setLoading(true)

    void fetch("/api/skills", { credentials: "same-origin" })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string
          skills?: SkillPickerEntry[]
        }

        if (!response.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "Could not load skills")
        }

        if (!cancelled) {
          setSkills(Array.isArray(data.skills) ? data.skills : [])
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSkills([])
          toast.error(error instanceof Error ? error.message : "Could not load skills")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open])

  React.useEffect(() => {
    if (!open) {
      setEditingSlug(null)
      setQuery("")
      setSendingSlug(null)
    }
  }, [open])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return skills
    }

    return skills.filter((skill) => {
      const title = (skill.title ?? "").toLowerCase()
      return skill.slug.toLowerCase().includes(q) || title.includes(q)
    })
  }, [query, skills])

  const handleLoad = async (slug: string) => {
    if (disabled || sendingSlug) {
      return
    }

    setSendingSlug(slug)

    try {
      await onRequestLoad(slug)
      onOpenChange(false)
    } catch {
      /* parent may toast */
    } finally {
      setSendingSlug(null)
    }
  }

  const handleSkillSaved = React.useCallback((updatedSkill: EditableSkill) => {
    setSkills((currentSkills) =>
      currentSkills.map((skill) =>
        skill.slug === updatedSkill.slug
          ? {
              ...skill,
              description: updatedSkill.description,
              title: updatedSkill.title || null,
            }
          : skill,
      ),
    )
  }, [])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(90dvh,32rem)] flex-col gap-0 p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border/60 px-6 py-4 text-left">
            <DialogTitle className="flex items-center gap-2">
              <Books className="size-5 shrink-0 opacity-80" weight="duotone" />
              Load a skill
            </DialogTitle>
            <DialogDescription>
              Sends a short message so the agent runs <span className="font-mono text-xs">activateSkill</span> for
              that slug.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 px-6 pb-2 pt-3">
            <Input
              placeholder="Search by name or slug..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={loading || disabled}
              aria-label="Filter skills"
            />
          </div>

          <ScrollArea className="min-h-0 flex-1 px-6">
            <div className="flex flex-col gap-2 pb-4 pr-3">
              {loading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <CircleNotch className="size-4 animate-spin" />
                  Loading skills...
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {skills.length === 0 ? "No skills available yet." : "No matches."}
                </p>
              ) : (
                filtered.map((skill) => (
                  <div
                    key={skill.slug}
                    className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{skill.title ?? skill.slug}</span>
                        {skill.isMine ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Yours
                          </Badge>
                        ) : skill.isPublic ? (
                          <Badge variant="outline" className="text-[10px]">
                            Public
                          </Badge>
                        ) : null}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">{skill.slug}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{skill.description}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                      {skill.isMine ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Open options for ${skill.slug}`}
                              disabled={disabled || Boolean(sendingSlug)}
                            >
                              <DotsThreeVertical className="size-4" weight="bold" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingSlug(skill.slug)}>
                              <PencilSimple className="mr-2 size-4" />
                              Edit skill
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}

                      <Button
                        type="button"
                        size="sm"
                        className="shrink-0"
                        disabled={disabled || Boolean(sendingSlug)}
                        onClick={() => void handleLoad(skill.slug)}
                      >
                        {sendingSlug === skill.slug ? (
                          <>
                            <CircleNotch className="mr-1 size-3.5 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          "Load"
                        )}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <SkillEditModal
        open={Boolean(editingSlug)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setEditingSlug(null)
          }
        }}
        slug={editingSlug}
        onSaved={handleSkillSaved}
      />
    </>
  )
}
