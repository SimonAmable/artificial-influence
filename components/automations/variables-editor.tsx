"use client"

import * as React from "react"
import { Dices, ListOrdered, Loader2, Plus, Trash2, Wand2 } from "lucide-react"
import { toast } from "sonner"

import type {
  AutomationPromptVariable,
  AutomationPromptVariableItem,
} from "@/lib/automations/prompt-payload"
import type { AttachedRef } from "@/lib/commands/types"
import { makeMentionToken } from "@/lib/commands/mention-token"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

function slugifyVariableId(name: string): string {
  const trimmed = name.trim()
  const base = trimmed
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
  let id = base.length > 0 ? base : "var"
  if (!/^[a-zA-Z]/.test(id)) {
    id = `v_${id}`
  }
  id = id.replace(/[^a-zA-Z0-9_-]/g, "")
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id)) {
    id = "var"
  }
  return id
}

function uniqueVariableId(name: string, existing: AutomationPromptVariable[]): string {
  const base = slugifyVariableId(name)
  const taken = new Set(existing.map((v) => v.id))
  if (!taken.has(base)) return base
  let n = 1
  while (taken.has(`${base}_${n}`)) n += 1
  return `${base}_${n}`
}

function makeNewVariable(existing: AutomationPromptVariable[]): AutomationPromptVariable {
  const label = `Variable ${existing.length + 1}`
  return {
    id: uniqueVariableId(label, existing),
    name: label,
    mode: "random",
    items: [],
  }
}

/** Non-empty text rows for this variable — used for single-variable AI expand threshold. */
function nonEmptyTextValueCount(v: AutomationPromptVariable): number {
  return v.items.filter((it) => it.kind === "text" && it.value.trim().length > 0).length
}

/** Samples / multi-variable context — required only when there is no automation prompt and no user hint. */
function hasStructuralExpandContext(
  v: AutomationPromptVariable,
  allVariables: AutomationPromptVariable[],
): boolean {
  if (allVariables.length >= 3) return true
  if (nonEmptyTextValueCount(v) >= 3) return true
  return false
}

function collectMentionTokens(
  variables: AutomationPromptVariable[],
  extraRefs: AttachedRef[],
): Set<string> {
  const s = new Set<string>()
  for (const r of extraRefs) {
    if (r.mentionToken) s.add(r.mentionToken)
  }
  for (const v of variables) {
    for (const it of v.items) {
      if (it.kind === "ref" && it.ref.mentionToken) s.add(it.ref.mentionToken)
    }
  }
  return s
}

export type VariablesEditorProps = {
  variables: AutomationPromptVariable[]
  onChange: (next: AutomationPromptVariable[]) => void
  /** Called with full token e.g. `{{celeb}}` */
  onInsertToken: (token: string) => void
  /** When user picks "Asset ref" and clicks pick — parent opens asset modal and calls this with the ref */
  onRequestPickRef: (variableId: string, itemIndex: number) => void
  /** Main prompt @-refs — used to avoid duplicate mention tokens */
  extraRefs?: AttachedRef[]
  /** Optional automation prompt text — sent as context for auto-expand */
  promptContext?: string
  disabled?: boolean
  className?: string
}

export function VariablesEditor({
  variables,
  onChange,
  onInsertToken,
  onRequestPickRef,
  extraRefs = [],
  promptContext = "",
  disabled = false,
  className,
}: VariablesEditorProps) {
  const [expandModalVariableId, setExpandModalVariableId] = React.useState<string | null>(null)
  const [expandUserHint, setExpandUserHint] = React.useState("")
  const [expandLoading, setExpandLoading] = React.useState(false)

  const expandTargetVariable =
    expandModalVariableId !== null ? variables.find((x) => x.id === expandModalVariableId) : undefined
  const canSubmitExpand =
    expandTargetVariable !== undefined &&
    (promptContext.trim().length > 0 ||
      expandUserHint.trim().length > 0 ||
      hasStructuralExpandContext(expandTargetVariable, variables))

  const addVariable = () => {
    onChange([...variables, makeNewVariable(variables)])
  }

  const updateVariable = (id: string, patch: Partial<AutomationPromptVariable>) => {
    onChange(variables.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  }

  const removeVariable = (id: string) => {
    onChange(variables.filter((v) => v.id !== id))
  }

  const setItemKind = (variableId: string, itemIndex: number, kind: AutomationPromptVariableItem["kind"]) => {
    const v = variables.find((x) => x.id === variableId)
    if (!v) return
    const taken = collectMentionTokens(variables, extraRefs)
    const nextItems = v.items.map((it, i) => {
      if (i !== itemIndex) return it
      if (kind === "text") return { kind: "text" as const, value: "" }
      if (kind === "attachment") {
        return { kind: "attachment" as const, url: "", mediaType: "application/octet-stream" }
      }
      const chipId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      const placeholder: AttachedRef = {
        id: chipId,
        label: "Asset",
        category: "asset",
        assetType: "image",
        serialized: "",
        chipId,
        mentionToken: "",
      }
      return {
        kind: "ref" as const,
        ref: { ...placeholder, mentionToken: makeMentionToken(placeholder, taken) },
      }
    })
    updateVariable(variableId, { items: nextItems })
  }

  const setItemTextValue = (variableId: string, itemIndex: number, value: string) => {
    const v = variables.find((x) => x.id === variableId)
    if (!v) return
    const nextItems = v.items.map((it, i) =>
      i === itemIndex && it.kind === "text" ? { ...it, value } : it,
    )
    updateVariable(variableId, { items: nextItems })
  }

  const setAttachmentFromUpload = async (variableId: string, itemIndex: number, file: File) => {
    const result = await uploadFileToSupabase(file, "chat-user-uploads")
    if (!result) return
    const v = variables.find((x) => x.id === variableId)
    if (!v) return
    const mediaType = file.type || "application/octet-stream"
    const nextItems = v.items.map((it, i) =>
      i === itemIndex && it.kind === "attachment"
        ? { kind: "attachment" as const, url: result.url, mediaType, filename: result.fileName }
        : it,
    )
    updateVariable(variableId, { items: nextItems })
  }

  const addItem = (variableId: string) => {
    const v = variables.find((x) => x.id === variableId)
    if (!v) return
    updateVariable(variableId, {
      items: [...v.items, { kind: "text", value: "" }],
    })
  }

  const removeItem = (variableId: string, itemIndex: number) => {
    const v = variables.find((x) => x.id === variableId)
    if (!v) return
    updateVariable(variableId, {
      items: v.items.filter((_, i) => i !== itemIndex),
    })
  }

  const runExpandList = async () => {
    if (!expandModalVariableId) return
    const v = variables.find((x) => x.id === expandModalVariableId)
    if (!v) return
    if (
      !(
        promptContext.trim().length > 0 ||
        expandUserHint.trim().length > 0 ||
        hasStructuralExpandContext(v, variables)
      )
    ) {
      return
    }
    const existingTextValues = v.items
      .filter((it): it is { kind: "text"; value: string } => it.kind === "text")
      .map((it) => it.value.trim())
      .filter(Boolean)
    const otherVariables = variables
      .filter((x) => x.id !== v.id)
      .map((o) => ({
        id: o.id,
        name: o.name,
        textSamples: o.items
          .filter((it): it is { kind: "text"; value: string } => it.kind === "text")
          .map((it) => it.value.trim())
          .filter(Boolean)
          .slice(0, 12),
      }))
    setExpandLoading(true)
    try {
      const res = await fetch("/api/automations/expand-variable-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetVariableId: v.id,
          targetVariableName: v.name,
          existingTextValues,
          otherVariables,
          userHint: expandUserHint.trim() || undefined,
          promptContext: promptContext.trim() || undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { items?: string[]; error?: string }
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Request failed")
      }
      const items = Array.isArray(data.items) ? data.items : []
      if (items.length === 0) {
        throw new Error("No items returned")
      }
      const newTextItems: AutomationPromptVariableItem[] = items.map((value) => ({
        kind: "text" as const,
        value,
      }))
      updateVariable(v.id, { items: [...v.items, ...newTextItems] })
      setExpandModalVariableId(null)
      setExpandUserHint("")
      toast.success(`Added ${items.length} text values`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to expand list")
    } finally {
      setExpandLoading(false)
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label className="text-sm">Variables</Label>
          <p className="text-xs text-muted-foreground">
            {variables.length === 0
              ? "No variables yet — add one to rotate names, images, or refs. "
              : null}
            Use <code className="rounded bg-muted px-1">{"{{id}}"}</code>
            {" in the prompt; each run picks one value from the list — random or in order."}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addVariable} disabled={disabled}>
          <Plus className="mr-1 size-3.5" />
          Add variable
        </Button>
      </div>

      <div className="space-y-3">
        {variables.map((v) => {
          const token = `{{${v.id}}}`
          const seqHint =
            v.mode === "sequential" && v.items.length > 0 ? (
              <span className="text-muted-foreground">
                Next: item #{(v.cursor ?? 0) % v.items.length} of {v.items.length}
              </span>
            ) : null

          return (
            <Card key={v.id} className="border-border/60 py-3">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2 pt-0">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[140px] flex-1 space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={v.name}
                        disabled={disabled}
                        onChange={(e) => updateVariable(v.id, { name: e.target.value })}
                        placeholder="e.g. Celebrity"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Token</Label>
                      <code className="block rounded border bg-muted/50 px-2 py-1.5 font-mono text-xs">{token}</code>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={disabled}
                      onClick={() => {
                        if (!disabled) onInsertToken(token)
                      }}
                    >
                      Insert
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Mode</span>
                    <div className="inline-flex rounded-md border border-border p-0.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={v.mode === "random" ? "default" : "ghost"}
                        className="h-7 gap-1 px-2 text-xs"
                        disabled={disabled}
                        onClick={() => updateVariable(v.id, { mode: "random" })}
                      >
                        <Dices className="size-3.5" />
                        Random
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={v.mode === "sequential" ? "default" : "ghost"}
                        className="h-7 gap-1 px-2 text-xs"
                        disabled={disabled}
                        onClick={() => updateVariable(v.id, { mode: "sequential" })}
                      >
                        <ListOrdered className="size-3.5" />
                        Sequential
                      </Button>
                    </div>
                    {seqHint}
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={disabled}
                  aria-label="Remove variable"
                  onClick={() => removeVariable(v.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {v.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Add at least one value for this variable to apply.</p>
                ) : null}
                {v.items.map((it, itemIndex) => (
                  <div
                    key={`${v.id}-${itemIndex}`}
                    className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/10 p-2 sm:flex-row sm:items-start"
                  >
                    <div className="w-full min-w-[100px] sm:w-32">
                      <Label className="text-xs">Kind</Label>
                      <Select
                        value={it.kind}
                        disabled={disabled}
                        onValueChange={(val) =>
                          setItemKind(v.id, itemIndex, val as AutomationPromptVariableItem["kind"])
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="attachment">File</SelectItem>
                          <SelectItem value="ref">Asset ref</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0 flex-1">
                      {it.kind === "text" ? (
                        <>
                          <Label className="text-xs">Value</Label>
                          <Input
                            value={it.value}
                            disabled={disabled}
                            onChange={(e) => setItemTextValue(v.id, itemIndex, e.target.value)}
                            placeholder="e.g. Donald Trump"
                            className="font-mono text-sm"
                          />
                        </>
                      ) : null}
                      {it.kind === "attachment" ? (
                        <div className="space-y-1">
                          <Label className="text-xs">File</Label>
                          {it.url ? (
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="truncate text-muted-foreground">{it.filename ?? it.url.slice(-32)}</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={disabled}
                                onClick={() => {
                                  const input = document.createElement("input")
                                  input.type = "file"
                                  input.onchange = () => {
                                    const f = input.files?.[0]
                                    if (f) void setAttachmentFromUpload(v.id, itemIndex, f)
                                  }
                                  input.click()
                                }}
                              >
                                Change
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={disabled}
                              onClick={() => {
                                const input = document.createElement("input")
                                input.type = "file"
                                input.onchange = () => {
                                  const f = input.files?.[0]
                                  if (f) void setAttachmentFromUpload(v.id, itemIndex, f)
                                }
                                input.click()
                              }}
                            >
                              Upload
                            </Button>
                          )}
                        </div>
                      ) : null}
                      {it.kind === "ref" ? (
                        <div className="space-y-1">
                          <Label className="text-xs">Reference</Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {it.ref.label} ({it.ref.mentionToken || "no token"})
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={disabled}
                              onClick={() => onRequestPickRef(v.id, itemIndex)}
                            >
                              Pick asset
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 self-end text-muted-foreground hover:text-destructive"
                      disabled={disabled}
                      aria-label="Remove value"
                      onClick={() => removeItem(v.id, itemIndex)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    disabled={disabled}
                    onClick={() => addItem(v.id)}
                  >
                    <Plus className="mr-1 size-3" />
                    Add value
                  </Button>
                  {!disabled ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => {
                        setExpandModalVariableId(v.id)
                        setExpandUserHint("")
                      }}
                    >
                      <Wand2 className="mr-1 size-3" />
                      Auto expand list
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog
        open={expandModalVariableId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setExpandModalVariableId(null)
            setExpandUserHint("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Auto-expand text list</DialogTitle>
            <DialogDescription>
              If your automation already has prompt text, you can generate from that alone. Otherwise add a suggestion
              below, or give the model examples: three non-empty values in this variable, or three variables for
              cross-context. New rows are appended as text values.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="expand-var-hint">Suggestion (optional)</Label>
            <Textarea
              id="expand-var-hint"
              value={expandUserHint}
              onChange={(e) => setExpandUserHint(e.target.value)}
              placeholder='e.g. "US politicians", "diverse first names", "mood adjectives"'
              rows={4}
              className="resize-y text-sm"
              disabled={expandLoading}
            />
            {expandTargetVariable && !canSubmitExpand ? (
              <p className="text-xs text-muted-foreground">
                Add automation prompt text, type a suggestion above, three non-empty values in this variable,
                or three variables total.
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExpandModalVariableId(null)}
              disabled={expandLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void runExpandList()}
              disabled={expandLoading || !canSubmitExpand}
              title={
                !canSubmitExpand && !expandLoading
                  ? "Need automation prompt text, a suggestion, three example values in this variable, or three variables"
                  : undefined
              }
            >
              {expandLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Wand2 className="mr-2 size-4" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
