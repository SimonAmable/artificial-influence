"use client"

import * as React from "react"
import { CircleNotch, PencilSimple } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export type EditableSkill = {
  description: string
  instructionsBody: string
  slug: string
  title: string
}

type SkillEditModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (skill: EditableSkill) => void
  slug: string | null
}

export function SkillEditModal({
  open,
  onOpenChange,
  onSaved,
  slug,
}: SkillEditModalProps) {
  const [skill, setSkill] = React.useState<EditableSkill | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    if (!open || !slug) {
      setSkill(null)
      setLoadError(null)
      setSaving(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(null)

    void fetch(`/api/skills/${encodeURIComponent(slug)}`, {
      credentials: "same-origin",
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string
          skill?: EditableSkill
        }

        if (!response.ok || !data.skill) {
          throw new Error(typeof data.error === "string" ? data.error : "Could not load skill.")
        }

        if (!cancelled) {
          setSkill(data.skill)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Could not load skill."
          setLoadError(message)
          setSkill(null)
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
  }, [open, reloadKey, slug])

  const canSave = Boolean(skill?.description.trim() && skill?.instructionsBody.trim() && !saving)

  const handleSave = async () => {
    if (!slug || !skill || saving) {
      return
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/skills/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          description: skill.description,
          instructionsBody: skill.instructionsBody,
          title: skill.title,
        }),
      })

      const data = (await response.json().catch(() => ({}))) as {
        error?: string
        skill?: EditableSkill
      }

      if (!response.ok || !data.skill) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not save skill.")
      }

      setSkill(data.skill)
      onSaved?.(data.skill)
      toast.success("Skill saved.")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save skill.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!saving) {
          onOpenChange(nextOpen)
        }
      }}
    >
      <DialogContent className="flex max-h-[min(92dvh,52rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/60 px-4 py-4 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <PencilSimple className="size-5 shrink-0 opacity-80" weight="duotone" />
            Edit skill
          </DialogTitle>
          <DialogDescription>Update the catalog metadata and the SKILL.md instructions.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <CircleNotch className="size-4 animate-spin" />
              Loading skill...
            </div>
          ) : loadError ? (
            <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">Could not open this skill</p>
              <p className="text-destructive/90">{loadError}</p>
              <Button type="button" variant="outline" onClick={() => setReloadKey((value) => value + 1)}>
                Try again
              </Button>
            </div>
          ) : skill ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="skill-edit-title">Title</Label>
                <Input
                  id="skill-edit-title"
                  value={skill.title}
                  onChange={(event) =>
                    setSkill((current) => (current ? { ...current, title: event.target.value } : current))
                  }
                  placeholder="Optional UI label"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="skill-edit-description">Description</Label>
                <Textarea
                  id="skill-edit-description"
                  value={skill.description}
                  onChange={(event) =>
                    setSkill((current) => (current ? { ...current, description: event.target.value } : current))
                  }
                  placeholder="What the skill does and when the agent should use it"
                  disabled={saving}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="skill-edit-body">Instructions</Label>
                <Textarea
                  id="skill-edit-body"
                  value={skill.instructionsBody}
                  onChange={(event) =>
                    setSkill((current) =>
                      current ? { ...current, instructionsBody: event.target.value } : current,
                    )
                  }
                  placeholder="Markdown instructions for the skill body"
                  disabled={saving}
                  rows={18}
                  className="min-h-[18rem] font-mono text-xs"
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border/60 px-4 py-4 sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={!canSave || loading || Boolean(loadError)}>
            {saving ? (
              <>
                <CircleNotch className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save skill"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
