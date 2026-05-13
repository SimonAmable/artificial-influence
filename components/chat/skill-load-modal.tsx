"use client"

import * as React from "react"
import {
  Books,
  CaretDown,
  ChatCircleDots,
  CircleNotch,
  GithubLogo,
  PencilSimple,
  Plus,
  ShieldStar,
  UploadSimple,
} from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { SkillEditModal, type EditableSkill } from "@/components/chat/skill-edit-modal"
import type { SkillPickerEntry } from "@/lib/chat/skills/catalog"

export type ModalView = "list" | "official" | "upload-preview" | "github-import"

export type PreviewSkillPayload = {
  skillDocument: string
  slug: string
  title: string
  description: string
  body: string
}

export type SkillLoadModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after user picks a skill; parent sends the user message and closes the modal. */
  onRequestLoad: (slug: string) => void | Promise<void>
  onPinnedSkillsChange?: () => void | Promise<void>
  /** Closes modal and primes the composer to build a skill via the agent conversation. */
  onBuildWithAI?: () => void
  disabled?: boolean
}

type AddSkillMenuProps = {
  disabled: boolean
  /** When omitted, the Build with AI item is hidden. */
  onPickBuildWithAI?: () => void
  onPickUpload: () => void
  onPickOfficial: () => void
  onPickGithub: () => void
}

function AddSkillMenu({
  disabled,
  onPickBuildWithAI,
  onPickUpload,
  onPickOfficial,
  onPickGithub,
}: AddSkillMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0 gap-1.5"
          disabled={disabled}
        >
          <Plus className="size-4" weight="bold" />
          Add
          <CaretDown className="size-3.5 opacity-70" weight="bold" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-1">
        {onPickBuildWithAI ? (
          <>
            <DropdownMenuItem
              className="flex cursor-pointer items-start gap-3 py-3"
              onSelect={(event) => {
                event.preventDefault()
                onPickBuildWithAI()
              }}
            >
              <ChatCircleDots className="mt-0.5 size-5 shrink-0 opacity-90" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm leading-tight font-medium">Build with AI</span>
                <span className="text-xs leading-snug text-muted-foreground">
                  Prompt the chat to create a SKILL.md and refine it together
                </span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem
          className="flex cursor-pointer items-start gap-3 py-3"
          onSelect={(event) => {
            event.preventDefault()
            onPickUpload()
          }}
        >
          <UploadSimple className="mt-0.5 size-5 shrink-0 opacity-90" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm leading-tight font-medium">Upload a skill</span>
            <span className="text-xs leading-snug text-muted-foreground">Upload SKILL.md (.md / .txt)</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex cursor-pointer items-start gap-3 py-3"
          onSelect={(event) => {
            event.preventDefault()
            onPickOfficial()
          }}
        >
          <ShieldStar className="mt-0.5 size-5 shrink-0 opacity-90" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm leading-tight font-medium">Add from official</span>
            <span className="text-xs leading-snug text-muted-foreground">
              Browse shared public skills maintained for everyone
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex cursor-pointer items-start gap-3 py-3"
          onSelect={(event) => {
            event.preventDefault()
            onPickGithub()
          }}
        >
          <GithubLogo className="mt-0.5 size-5 shrink-0 opacity-90" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm leading-tight font-medium">Import from GitHub</span>
            <span className="text-xs leading-snug text-muted-foreground">
              Paste a repository or raw file URL pointing at SKILL.md
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SkillBodyPreviewSnippet({ body }: { body: string }) {
  const preview = React.useMemo(() => {
    const max = 800
    if (body.length <= max) {
      return body
    }
    return `${body.slice(0, max).trim()}…`
  }, [body])

  return (
    <pre className="max-h-[min(320px,40dvh)] overflow-auto rounded-lg border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed whitespace-pre-wrap wrap-break-word">
      {preview}
    </pre>
  )
}

export function SkillLoadModal({
  open,
  onOpenChange,
  onRequestLoad,
  onPinnedSkillsChange,
  onBuildWithAI,
  disabled = false,
}: SkillLoadModalProps) {
  const [skills, setSkills] = React.useState<SkillPickerEntry[]>([])
  const [loading, setLoading] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [view, setView] = React.useState<ModalView>("list")
  const [previewSkill, setPreviewSkill] = React.useState<PreviewSkillPayload | null>(null)
  const [savingPreview, setSavingPreview] = React.useState(false)
  const [githubUrl, setGithubUrl] = React.useState("")
  const [githubFetching, setGithubFetching] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [sendingSlug, setSendingSlug] = React.useState<string | null>(null)
  const [pinningSlug, setPinningSlug] = React.useState<string | null>(null)
  const [editingSlug, setEditingSlug] = React.useState<string | null>(null)

  const refreshSkillsCatalog = React.useCallback(() => {
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

        setSkills(Array.isArray(data.skills) ? data.skills : [])
      })
      .catch((error: unknown) => {
        setSkills([])
        toast.error(error instanceof Error ? error.message : "Could not load skills")
      })
      .finally(() => setLoading(false))
  }, [])

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
      setPinningSlug(null)
      setQuery("")
      setSendingSlug(null)
      setView("list")
      setPreviewSkill(null)
      setSavingPreview(false)
      setGithubUrl("")
      setGithubFetching(false)
    }
  }, [open])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return skills
    }

    return skills.filter((skill) => {
      const title = (skill.title ?? "").toLowerCase()
      const desc = skill.description.toLowerCase()
      return (
        skill.slug.toLowerCase().includes(q) || title.includes(q) || desc.includes(q)
      )
    })
  }, [query, skills])

  const filteredMine = React.useMemo(() => filtered.filter((s) => s.isMine), [filtered])

  const filteredOfficial = React.useMemo(
    () => filtered.filter((s) => s.isPublic && !s.isMine),
    [filtered],
  )

  const hasOfficialSkills = React.useMemo(
    () => skills.some((s) => s.isPublic && !s.isMine),
    [skills],
  )

  const handleLoad = React.useCallback(
    async (slug: string) => {
      if (disabled) {
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
    },
    [disabled, onOpenChange, onRequestLoad],
  )

  const handlePinToggle = async (skill: SkillPickerEntry, successToast?: string) => {
    if (disabled || sendingSlug || pinningSlug) {
      return
    }

    setPinningSlug(skill.slug)

    try {
      const response = await fetch(
        skill.isPinned ? `/api/skills/pins/${skill.slug}` : "/api/skills/pins",
        {
          method: skill.isPinned ? "DELETE" : "POST",
          credentials: "same-origin",
          headers: skill.isPinned ? undefined : { "Content-Type": "application/json" },
          body: skill.isPinned ? undefined : JSON.stringify({ slug: skill.slug }),
        },
      )

      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not update pinned skill.")
      }

      setSkills((currentSkills) =>
        currentSkills.map((entry) =>
          entry.slug === skill.slug ? { ...entry, isPinned: !skill.isPinned } : entry,
        ),
      )

      await onPinnedSkillsChange?.()
      toast.success(successToast ?? (skill.isPinned ? "Skill unpinned." : "Skill pinned for every chat."))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update pinned skill.")
    } finally {
      setPinningSlug(null)
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

  const handleGithubFetch = React.useCallback(async () => {
    if (disabled || githubFetching) {
      return
    }
    setGithubFetching(true)
    try {
      const response = await fetch("/api/skills/import-github", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: githubUrl.trim() }),
      })
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
        skillDocument?: string
        slug?: string
        description?: string
        body?: string
      }

      if (!response.ok || typeof data.skillDocument !== "string" || typeof data.slug !== "string") {
        throw new Error(typeof data.error === "string" ? data.error : "Could not import from GitHub.")
      }

      setPreviewSkill({
        skillDocument: data.skillDocument,
        slug: data.slug,
        title: data.slug,
        description: typeof data.description === "string" ? data.description : "",
        body: typeof data.body === "string" ? data.body : "",
      })
      setView("upload-preview")
      toast.success("Skill fetched — review and save.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import from GitHub.")
    } finally {
      setGithubFetching(false)
    }
  }, [disabled, githubFetching, githubUrl])

  const handleSavePreview = React.useCallback(async () => {
    if (!previewSkill || disabled || savingPreview) {
      return
    }
    setSavingPreview(true)
    try {
      const response = await fetch("/api/skills", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillDocument: previewSkill.skillDocument }),
      })
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
        skills?: SkillPickerEntry[]
      }
      if (!response.ok || !Array.isArray(data.skills)) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not save skill.")
      }

      setSkills(data.skills)
      setPreviewSkill(null)
      setView("list")
      toast.success(`Skill "${previewSkill.slug}" saved to your library.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save skill.")
    } finally {
      setSavingPreview(false)
    }
  }, [disabled, previewSkill, savingPreview])

  const handleFileChosen = React.useCallback(
    async (file: File) => {
      if (disabled) {
        return
      }
      const text = await file.text()
      try {
        const response = await fetch("/api/skills/parse", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        })
        const data = (await response.json().catch(() => ({}))) as {
          error?: string
          skillDocument?: string
          slug?: string
          description?: string
          body?: string
        }
        if (
          !response.ok ||
          typeof data.skillDocument !== "string" ||
          typeof data.slug !== "string"
        ) {
          throw new Error(typeof data.error === "string" ? data.error : "Invalid SKILL.md file.")
        }

        setPreviewSkill({
          skillDocument: data.skillDocument,
          slug: data.slug,
          title: data.slug,
          description: typeof data.description === "string" ? data.description : "",
          body: typeof data.body === "string" ? data.body : "",
        })
        setView("upload-preview")
        toast.success("Skill parsed — review and save.")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not parse file.")
      }
    },
    [disabled],
  )

  const navigateBackFromSubView = React.useCallback(() => {
    setPreviewSkill(null)
    setGithubUrl("")
    setView("list")
  }, [])

  const headerTitle =
    view === "official"
      ? "Official skills"
      : view === "github-import"
        ? "Import from GitHub"
        : view === "upload-preview"
          ? "Preview skill"
          : "Load a skill"

  const headerDescription =
    view === "official"
      ? "Browse and pin community-maintained public skills."
      : view === "github-import"
        ? "Paste a GitHub repo or raw file URL for SKILL.md. We fetch and validate it server-side."
        : view === "upload-preview"
          ? "Confirm the SKILL.md summary and instructions look right, then save to your library."
          : "Load uses a skill just for this conversation. Pin makes it active in every chat by default."

  const renderSkillRows = React.useCallback(
    (subset: SkillPickerEntry[], options: { mode: "combined" | "official-only" }) => {
      if (subset.length === 0) {
        return null
      }

      return subset.map((skill) => {
        const isOfficialOnlyRow = options.mode === "official-only"
        const showEdit = skill.isMine && !isOfficialOnlyRow

        const pinLabel = isOfficialOnlyRow
          ? skill.isPinned
            ? "Unpin"
            : "Install"
          : skill.isPinned
            ? "Unpin"
            : "Pin"

        return (
          <div
            key={skill.slug}
            className="flex min-w-0 flex-col gap-2 overflow-hidden rounded-lg border border-border/60 bg-muted/10 p-3 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0 max-w-full flex-1 space-y-1">
              <div className="flex min-w-0 items-start gap-2">
                <span className="min-w-0 flex-1 font-medium line-clamp-2 wrap-break-word">
                  {skill.title?.trim() || "Untitled skill"}
                </span>
                {skill.isMine ? (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    Yours
                  </Badge>
                ) : skill.isPublic ? (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    Public
                  </Badge>
                ) : null}
                {skill.isPinned ? (
                  <Badge variant="default" className="shrink-0 text-[10px]">
                    Pinned
                  </Badge>
                ) : null}
              </div>
              <p className="line-clamp-2 min-w-0 wrap-break-word text-xs text-muted-foreground">
                {skill.description}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 self-start md:self-center">
              {showEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={disabled || Boolean(sendingSlug)}
                  onClick={() => setEditingSlug(skill.slug)}
                >
                  <PencilSimple className="mr-1.5 size-3.5" />
                  Edit
                </Button>
              ) : null}

              <Button
                type="button"
                variant={skill.isPinned ? "secondary" : "outline"}
                size="sm"
                className="shrink-0"
                disabled={disabled || Boolean(sendingSlug) || Boolean(pinningSlug)}
                onClick={() =>
                  void handlePinToggle(
                    skill,
                    isOfficialOnlyRow
                      ? skill.isPinned
                        ? "Removed from pinned skills."
                        : "Installed — this skill stays active in every new chat."
                      : undefined,
                  )
                }
              >
                {pinningSlug === skill.slug ? (
                  <>
                    <CircleNotch className="mr-1 size-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  pinLabel
                )}
              </Button>

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
        )
      })
    },
    [disabled, handleLoad, handlePinToggle, pinningSlug, sendingSlug],
  )

  const dropdownDisabled =
    disabled || loading || Boolean(sendingSlug || pinningSlug || savingPreview || githubFetching)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[min(90dvh,44rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl">
          <DialogHeader className="gap-3 border-b border-border/60 px-4 py-4 text-left sm:flex-row sm:items-start sm:justify-between sm:px-6">
            <div className="flex min-w-0 flex-col gap-1.5 pr-8 sm:pr-0">
              <DialogTitle className="flex items-center gap-2">
                <Books className="size-5 shrink-0 opacity-80" weight="duotone" />
                {headerTitle}
              </DialogTitle>
              <DialogDescription>{headerDescription}</DialogDescription>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 sm:self-start">
              {view !== "list" ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => navigateBackFromSubView()}>
                  ← Back
                </Button>
              ) : null}
              {view === "list" ? (
                <AddSkillMenu
                  disabled={dropdownDisabled}
                  onPickBuildWithAI={onBuildWithAI}
                  onPickOfficial={() => setView("official")}
                  onPickGithub={() => setView("github-import")}
                  onPickUpload={() => fileInputRef.current?.click()}
                />
              ) : null}
            </div>
          </DialogHeader>

          {(view === "list" || view === "official") && (
            <div className="flex flex-col gap-3 px-4 pb-2 pt-3 sm:px-6">
              <Input
                placeholder="Search skills…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={loading || disabled}
                aria-label="Filter skills"
              />
            </div>
          )}

          {view === "github-import" ? (
            <div className="flex flex-col gap-3 px-4 py-4 sm:px-6">
              <p className="text-sm text-muted-foreground">
                Examples:
                <code className="ml-1 mr-2 rounded-md bg-muted px-1 py-0.5 text-xs">
                  github.com/owner/repo
                </code>
                or paste a blob / raw SKILL.md URL.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  placeholder="https://github.com/owner/repo…"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  disabled={disabled || githubFetching}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void handleGithubFetch()
                    }
                  }}
                  aria-label="GitHub repository or raw URL"
                />
                <Button
                  type="button"
                  className="shrink-0"
                  disabled={disabled || githubFetching || !githubUrl.trim()}
                  onClick={() => void handleGithubFetch()}
                >
                  {githubFetching ? (
                    <>
                      <CircleNotch className="mr-2 size-4 animate-spin" />
                      Fetching…
                    </>
                  ) : (
                    "Fetch SKILL.md"
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          {view === "upload-preview" && previewSkill ? (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden px-4 py-4 sm:px-6">
              <div className="space-y-1">
                <p className="text-sm font-medium">{previewSkill.slug}</p>
                <p className="text-xs text-muted-foreground wrap-break-word">{previewSkill.description}</p>
              </div>
              <div className="min-h-0 flex-1 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Instructions preview</p>
                <SkillBodyPreviewSnippet body={previewSkill.body} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={disabled || savingPreview}
                  onClick={() => void handleSavePreview()}
                >
                  {savingPreview ? (
                    <>
                      <CircleNotch className="mr-2 size-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save skill"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingPreview}
                  onClick={() => {
                    setPreviewSkill(null)
                    setView("list")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {(view === "list" || view === "official") && (
            <ScrollArea className="**:data-[slot=scroll-area-viewport]:min-w-0 min-h-0 min-w-0 flex-1 px-4 sm:px-6">
              <div className="flex min-w-0 flex-col gap-2 pb-4 pr-3">
                {loading ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <CircleNotch className="size-4 animate-spin" />
                    Loading skills...
                  </div>
                ) : view === "official" ? (
                  filteredOfficial.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {skills.length === 0
                        ? "No skills available yet."
                        : skills.some((s) => s.isPublic && !s.isMine)
                          ? "No matching public skills."
                          : "No shared public skills in the catalog yet."}
                    </p>
                  ) : (
                    renderSkillRows(filteredOfficial, { mode: "official-only" })
                  )
                ) : filteredMine.length === 0 && filteredOfficial.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {skills.length === 0 ? "No skills available yet." : "No matches."}
                  </p>
                ) : (
                  <>
                    {filteredMine.length > 0 ? (
                      <>
                        {hasOfficialSkills && filteredOfficial.length > 0 ? (
                          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            My skills
                          </p>
                        ) : null}
                        {renderSkillRows(filteredMine, { mode: "combined" })}
                      </>
                    ) : null}

                    {filteredOfficial.length > 0 ? (
                      <>
                        {filteredMine.length > 0 ? (
                          <>
                            <Separator className="my-2" />
                            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                              Official skills
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                              Official skills
                            </p>
                          </>
                        )}
                        {renderSkillRows(filteredOfficial, { mode: "combined" })}
                      </>
                    ) : null}
                  </>
                )}
              </div>
            </ScrollArea>
          )}
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
        onSaved={(saved) => {
          handleSkillSaved(saved)
          refreshSkillsCatalog()
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.txt,text/markdown,text/plain"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) {
            void handleFileChosen(file)
          }
        }}
      />
    </>
  )
}
