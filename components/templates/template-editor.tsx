"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CircleNotch, Plus, Sparkle, Trash, Image as ImageIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import type {
  Template,
  TemplateCategory,
  TemplateInput,
  TemplateInputKind,
  TemplateVisibility,
} from "@/lib/templates/types"
import {
  TEMPLATE_CATEGORIES,
  CATEGORY_LABELS,
  OUTPUT_KIND_LABELS,
  buildTemplateSlug,
  guessCreditsCost,
} from "@/lib/templates/types"
import {
  assignInputIds,
  buildPlaceholderHint,
  createDefaultInput,
  type DraftTemplateInput,
  INPUT_KIND_LABELS,
  placeholderToken,
} from "@/lib/templates/input-utils"
import type { TemplateEditorDraft } from "@/lib/templates/editor-draft"
import {
  createTemplateEditorDraftFromTemplate,
  normalizeTemplateEditorDraft,
} from "@/lib/templates/editor-draft"
import { consumePendingTemplateEditorDraft } from "@/lib/templates/editor-draft-handoff"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { TemplateRunForm } from "@/components/templates/template-run-form"
import { Button } from "@/components/ui/button"
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
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

const CREATOR_OUTPUT_KINDS = ["image", "video", "audio"] as const
type TemplateEditorOutputKind = (typeof CREATOR_OUTPUT_KINDS)[number]

const ADD_INPUT_KINDS: TemplateInputKind[] = [
  "image",
  "video",
  "audio",
  "text",
  "boolean",
  "aspect_ratio",
]

interface TemplateEditorProps {
  initial?: Template
}

export function TemplateEditor({ initial }: TemplateEditorProps) {
  const router = useRouter()
  const isEdit = Boolean(initial)
  const promptRef = React.useRef<HTMLTextAreaElement>(null)
  const hasHydratedPendingDraftRef = React.useRef(false)

  const [name, setName] = React.useState(initial?.title ?? "")
  const [description, setDescription] = React.useState(initial?.description ?? "")
  const [tips, setTips] = React.useState(initial?.tips ?? "")
  const [prompt, setPrompt] = React.useState(initial?.prompt ?? "")
  const [category, setCategory] = React.useState<TemplateCategory>(initial?.category ?? "photo")
  const [outputKind, setOutputKind] = React.useState<TemplateEditorOutputKind>(
    initial?.output_kind === "image" ||
      initial?.output_kind === "video" ||
      initial?.output_kind === "audio"
      ? initial.output_kind
      : "image",
  )
  const [draftInputs, setDraftInputs] = React.useState<DraftTemplateInput[]>(() =>
    initial?.inputs
      ? initial.inputs.map((input) => ({ ...input } as DraftTemplateInput))
      : [],
  )
  const [visibility, setVisibility] = React.useState<TemplateVisibility>(
    initial?.visibility ?? "private",
  )
  const [thumbnailUrl, setThumbnailUrl] = React.useState<string | null>(
    initial?.thumbnail_url ?? null,
  )
  const [thumbnailKind, setThumbnailKind] = React.useState<"image" | "video">(
    initial?.thumbnail_kind ?? "image",
  )
  const [isSaving, setIsSaving] = React.useState(false)
  const [isUploadingThumb, setIsUploadingThumb] = React.useState(false)
  const [aiInstruction, setAiInstruction] = React.useState("")
  const [isApplyingAi, setIsApplyingAi] = React.useState(false)
  const [lastAiSummary, setLastAiSummary] = React.useState<string | null>(null)

  const resolvedInputs = React.useMemo(
    () => assignInputIds(draftInputs),
    [draftInputs],
  )

  const creditsCost = initial?.credits_cost_locked
    ? (initial.credits_cost ?? guessCreditsCost(outputKind))
    : guessCreditsCost(outputKind)

  const previewTemplate: Template = {
    id: initial?.id ?? "preview",
    creator_id: initial?.creator_id ?? "",
    slug: buildTemplateSlug(name || "preview"),
    title: name || "Untitled",
    description,
    tips: tips || null,
    thumbnail_url: thumbnailUrl,
    thumbnail_kind: thumbnailKind,
    category,
    prompt,
    output_kind: outputKind,
    inputs: resolvedInputs,
    credits_cost: creditsCost,
    credits_cost_locked: initial?.credits_cost_locked ?? false,
    last_run_credits: initial?.last_run_credits ?? null,
    run_count: initial?.run_count ?? 0,
    visibility,
    created_at: initial?.created_at ?? new Date().toISOString(),
    updated_at: initial?.updated_at ?? new Date().toISOString(),
  }

  const applyDraft = React.useCallback((draft: TemplateEditorDraft) => {
    const normalized = normalizeTemplateEditorDraft(draft)
    setName(normalized.title)
    setDescription(normalized.description)
    setTips(normalized.tips)
    setPrompt(normalized.prompt)
    setCategory(normalized.category)
    setOutputKind(normalized.output_kind)
    setDraftInputs(normalized.inputs)
    setVisibility(normalized.visibility)
    setThumbnailUrl(normalized.thumbnail_url)
    setThumbnailKind(normalized.thumbnail_kind)
  }, [])

  const buildCurrentDraft = React.useCallback((): TemplateEditorDraft => {
    const source = initial
      ? createTemplateEditorDraftFromTemplate(initial)
      : normalizeTemplateEditorDraft(null)

    return {
      ...source,
      title: name,
      description,
      tips,
      category,
      output_kind: outputKind,
      prompt,
      inputs: draftInputs.map((input) => ({ ...input })),
      visibility,
      thumbnail_url: thumbnailUrl,
      thumbnail_kind: thumbnailKind,
    }
  }, [
    category,
    description,
    draftInputs,
    initial,
    name,
    outputKind,
    prompt,
    thumbnailKind,
    thumbnailUrl,
    tips,
    visibility,
  ])

  React.useEffect(() => {
    if (initial || hasHydratedPendingDraftRef.current) return
    hasHydratedPendingDraftRef.current = true

    const pendingDraft = consumePendingTemplateEditorDraft()
    if (!pendingDraft) return

    applyDraft(pendingDraft)
    setLastAiSummary("AI prepared a first draft. You can keep editing before saving.")
  }, [applyDraft, initial])

  const insertPlaceholder = (input: TemplateInput) => {
    const token = placeholderToken(input)
    const el = promptRef.current
    if (!el) {
      setPrompt((p) => (p ? `${p} ${token}` : token))
      return
    }
    const start = el.selectionStart ?? prompt.length
    const end = el.selectionEnd ?? prompt.length
    const next = prompt.slice(0, start) + token + prompt.slice(end)
    setPrompt(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }

  const handleThumbnailUpload = async (file: File) => {
    setIsUploadingThumb(true)
    try {
      const uploaded = await uploadFileToSupabase(file, "template-thumbnails")
      if (!uploaded) return
      setThumbnailUrl(uploaded.url)
      setThumbnailKind(file.type.startsWith("video/") ? "video" : "image")
    } finally {
      setIsUploadingThumb(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Give your template a name")
      return
    }
    if (!prompt.trim()) {
      toast.error("Describe what the AI should do")
      return
    }

    if (visibility === "public" && !thumbnailUrl) {
      toast.error("Add a cover image or video before making this template public")
      return
    }

    const inputs = assignInputIds(draftInputs)
    const slug = buildTemplateSlug(name)

    setIsSaving(true)
    try {
      const body = {
        slug,
        title: name.trim(),
        description: description.trim(),
        tips: tips.trim() || null,
        thumbnail_url: thumbnailUrl,
        thumbnail_kind: thumbnailKind,
        category,
        prompt: prompt.trim(),
        output_kind: outputKind,
        inputs,
        credits_cost: creditsCost,
        visibility,
      }

      const url = isEdit ? `/api/templates/${initial!.id}` : "/api/templates"
      const method = isEdit ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const err =
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error ?? "Failed to save")
        throw new Error(err)
      }

      toast.success(isEdit ? "Template saved" : "Template created")
      router.push(`/templates/${data.template?.slug ?? slug}`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save template")
    } finally {
      setIsSaving(false)
    }
  }

  const handleAiAssist = async () => {
    if (!aiInstruction.trim()) {
      toast.error("Tell AI what you want to change")
      return
    }

    setIsApplyingAi(true)
    try {
      const response = await fetch("/api/templates/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: isEdit ? "edit" : "create",
          instruction: aiInstruction.trim(),
          currentDraft: buildCurrentDraft(),
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const err =
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error ?? "Failed to update template draft")
        throw new Error(err)
      }

      applyDraft(data.draft as TemplateEditorDraft)
      setLastAiSummary(
        typeof data.summary === "string" && data.summary.trim()
          ? data.summary.trim()
          : "AI updated the draft.",
      )
      setAiInstruction("")
      toast.success(isEdit ? "Template draft updated with AI" : "Template draft created with AI")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update template draft")
    } finally {
      setIsApplyingAi(false)
    }
  }

  return (
    <div className="grid min-h-screen pt-[60px] lg:grid-cols-2">
      <div className="border-b lg:border-b-0 lg:border-r p-6 sm:p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-60px)]">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEdit ? "Edit template" : "Create a template"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Set up a reusable workflow. People fill in a simple form, then generation runs in chat.
          </p>
        </div>

        <section className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Coconut water dance"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Short description</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What will people create with this?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-tips">Tip for users (optional)</Label>
            <Input
              id="template-tips"
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              placeholder="Upload a clear photo of your face"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Cover media {visibility === "public" ? "(required for public templates)" : "(optional)"}
            </Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div
                className={cn(
                  "relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/30",
                  !thumbnailUrl && "border-dashed",
                )}
              >
                {thumbnailUrl ? (
                  thumbnailKind === "video" ? (
                    <video src={thumbnailUrl} className="h-full w-full object-cover" muted />
                  ) : (
                    <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  )
                ) : (
                  <ImageIcon className="size-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Button type="button" variant="outline" disabled={isUploadingThumb} asChild>
                  <label className="cursor-pointer">
                    {isUploadingThumb ? "Uploading…" : "Upload cover"}
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void handleThumbnailUpload(file)
                      }}
                    />
                  </label>
                </Button>
                <p className="text-xs text-muted-foreground">
                  Shown in the template gallery. You can use either an image or a video.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Creates</Label>
              <Select value={outputKind} onValueChange={(v) => setOutputKind(v as TemplateEditorOutputKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREATOR_OUTPUT_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {OUTPUT_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Public template</p>
              <p className="text-xs text-muted-foreground">
                Anyone can find and run it from the gallery
              </p>
            </div>
            <SwitchVisibility
              checked={visibility === "public"}
              onCheckedChange={(pub) => setVisibility(pub ? "public" : "private")}
            />
          </div>

          {initial?.credits_cost_locked ? (
            <p className="text-xs text-muted-foreground">
              Credit cost is set to ~{initial.credits_cost} based on real runs.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Estimated cost: ~{creditsCost} credits (updates automatically after the first run).
            </p>
          )}
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-medium">What should the AI do?</h2>
            <p className="text-xs text-muted-foreground">
              Write plain instructions. Uploaded files are sent automatically. Use the buttons below
              to reference choices like format or extra text.
            </p>
          </div>

          <Textarea
            ref={promptRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            placeholder="Put the person from the photo into the coconut water dance. Use vertical format."
            className="max-h-96 overflow-y-auto text-sm"
          />

          {resolvedInputs.some((i) => i.kind !== "image" && i.kind !== "video" && i.kind !== "audio") ? (
            <div className="flex flex-wrap gap-2">
              {resolvedInputs
                .filter((i) => i.kind !== "image" && i.kind !== "video" && i.kind !== "audio")
                .map((input) => (
                  <Button
                    key={input.label}
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 text-xs"
                    onClick={() => insertPlaceholder(input)}
                  >
                    Insert {input.label}
                  </Button>
                ))}
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">{buildPlaceholderHint(resolvedInputs)}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium">What do people need to provide?</h2>

          <div className="flex flex-wrap gap-2">
            {ADD_INPUT_KINDS.map((kind) => (
              <Button
                key={kind}
                type="button"
                size="sm"
                variant="outline"
                className="h-9"
                onClick={() =>
                  setDraftInputs((current) => [...current, createDefaultInput(kind)])
                }
              >
                <Plus className="mr-1 size-3.5" />
                {INPUT_KIND_LABELS[kind]}
              </Button>
            ))}
          </div>

          {draftInputs.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Add at least one field — usually a photo upload.
            </p>
          ) : (
            <div className="space-y-3">
              {draftInputs.map((input, index) => (
                <div
                  key={index}
                  className="rounded-xl border bg-card p-4 space-y-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="secondary" className="font-normal">
                      {INPUT_KIND_LABELS[input.kind]}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() =>
                        setDraftInputs((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      <Trash className="size-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Shown as</Label>
                    <Input
                      value={input.label}
                      onChange={(e) =>
                        setDraftInputs((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, label: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder="Your photo"
                    />
                  </div>

                  {(input.kind === "image" ||
                    input.kind === "video" ||
                    input.kind === "audio") && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Helper text (optional)</Label>
                      <Input
                        value={input.helpText ?? ""}
                        onChange={(e) =>
                          setDraftInputs((current) =>
                            current.map((item, i) =>
                              i === index ? { ...item, helpText: e.target.value } : item,
                            ),
                          )
                        }
                        placeholder="Upload a clear photo of your face"
                      />
                    </div>
                  )}

                  {input.kind === "text" && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Placeholder (optional)</Label>
                      <Input
                        value={input.placeholder ?? ""}
                        onChange={(e) =>
                          setDraftInputs((current) =>
                            current.map((item, i) =>
                              i === index ? { ...item, placeholder: e.target.value } : item,
                            ),
                          )
                        }
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={input.required}
                      onCheckedChange={(checked) =>
                        setDraftInputs((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, required: checked === true } : item,
                          ),
                        )
                      }
                    />
                    Required
                  </label>
                </div>
              ))}
            </div>
          )}
        </section>

        <Button className="w-full rounded-full h-12" disabled={isSaving} onClick={() => void handleSave()}>
          {isSaving ? (
            <>
              <CircleNotch className="mr-2 size-4 animate-spin" weight="bold" />
              Saving…
            </>
          ) : isEdit ? (
            "Save template"
          ) : (
            "Create template"
          )}
        </Button>
      </div>

      <div className="space-y-4 p-6 sm:p-8 bg-muted/20 overflow-y-auto max-h-[calc(100vh-60px)]">
        <p className="text-sm font-medium text-muted-foreground mb-4">Preview — what runners see</p>
        <div className="mx-auto max-w-lg rounded-2xl border bg-background p-6 shadow-sm">
          <div className="mb-6 space-y-2 text-center">
            {thumbnailUrl ? (
              <div className="mx-auto size-14 overflow-hidden rounded-xl">
                {thumbnailKind === "video" ? (
                  <video
                    src={thumbnailUrl}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    loop
                    autoPlay
                  />
                ) : (
                  <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
            ) : null}
            <h2 className="text-xl font-semibold">{previewTemplate.title}</h2>
            {previewTemplate.description ? (
              <p className="text-sm text-muted-foreground">{previewTemplate.description}</p>
            ) : null}
            {previewTemplate.tips ? (
              <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-left text-xs text-emerald-800 dark:text-emerald-200">
                {previewTemplate.tips}
              </div>
            ) : null}
          </div>
          <TemplateRunForm template={previewTemplate} disabled />
        </div>

        <div className="mx-auto max-w-lg rounded-2xl border bg-background p-5 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkle className="size-4 text-amber-500" weight="fill" />
              <h3 className="text-sm font-medium">
                {isEdit ? "Ask AI to edit this template" : "Ask AI to build or refine this template"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Describe the workflow you want, or ask for a specific change like adding
              fields, tightening the instructions, or changing the output format.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            <Textarea
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              rows={4}
              disabled={isApplyingAi}
              placeholder={
                isEdit
                  ? "Make this template better for faceless TikTok product videos and add a text field for the product name."
                  : "Create a template for turning one selfie into a cinematic perfume ad."
              }
            />

            {lastAiSummary ? (
              <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                {lastAiSummary}
              </p>
            ) : null}

            <Button
              type="button"
              className="w-full"
              variant="secondary"
              disabled={isApplyingAi}
              onClick={() => void handleAiAssist()}
            >
              {isApplyingAi ? (
                <>
                  <CircleNotch className="mr-2 size-4 animate-spin" weight="bold" />
                  Applying AI changes...
                </>
              ) : (
                <>
                  <Sparkle className="mr-2 size-4" weight="fill" />
                  {isEdit ? "Edit With AI" : "Generate With AI"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SwitchVisibility({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  )
}
